package main

import (
	"context"
	"flag"
	"fmt"
	"net"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/sirupsen/logrus"
	"github.com/xpzouying/xiaohongshu-mcp/configs"
)

func main() {
	var (
		headless    bool
		binPath     string // 浏览器二进制文件路径
		port        int
		desktopMode bool
	)
	flag.BoolVar(&headless, "headless", true, "是否无头模式")
	flag.StringVar(&binPath, "bin", "", "浏览器二进制文件路径")
	flag.IntVar(&port, "port", 18060, "HTTP 端口，0 表示自动分配")
	flag.BoolVar(&desktopMode, "desktop", false, "桌面应用模式（Electron）")
	flag.Parse()

	if desktopMode {
		// 桌面模式默认使用非无头浏览器，端口自动分配
		headless = false
		if port == 18060 {
			port = 0
		}
	}

	if len(binPath) == 0 {
		binPath = os.Getenv("ROD_BROWSER_BIN")
	}

	configs.InitHeadless(headless)
	configs.SetBinPath(binPath)

	// 初始化服务
	xiaohongshuService := NewXiaohongshuService()

	// 创建并启动应用服务器
	appServer := NewAppServer(xiaohongshuService)
	addr := fmt.Sprintf(":%d", port)
	actualAddr, err := appServer.Start(addr)
	if err != nil {
		logrus.Fatalf("failed to start server: %v", err)
	}
	if err := waitForHealth(actualAddr, 15*time.Second); err != nil {
		logrus.Fatalf("server health check failed: %v", err)
	}

	logrus.Infof("HTTP 服务监听地址: %s", actualAddr)
	fmt.Printf("APP_SERVER_ADDR=%s\n", actualAddr)

	if err := appServer.Wait(); err != nil {
		logrus.Fatalf("server stopped with error: %v", err)
	}
}

func waitForHealth(addr string, timeout time.Duration) error {
	url := buildHealthURL(addr)
	client := &http.Client{
		Timeout: 3 * time.Second,
	}

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return err
		}

		resp, err := client.Do(req)
		if err == nil {
			if resp.StatusCode == http.StatusOK {
				resp.Body.Close()
				return nil
			}
			resp.Body.Close()
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
		}
	}
}

func buildHealthURL(addr string) string {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return fmt.Sprintf("http://%s/health", addr)
	}

	normalizedHost := normalizeHost(host)

	if strings.Contains(normalizedHost, ":") {
		return fmt.Sprintf("http://[%s]:%s/health", normalizedHost, port)
	}

	return fmt.Sprintf("http://%s:%s/health", normalizedHost, port)
}

func normalizeHost(host string) string {
	switch host {
	case "", "0.0.0.0", "::", "[::]":
		return "127.0.0.1"
	}

	if strings.HasPrefix(host, "[") && strings.HasSuffix(host, "]") {
		return host[1 : len(host)-1]
	}

	return host
}
