package main

import (
	"context"
	"errors"
	"net"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/sirupsen/logrus"
)

// AppServer 应用服务器结构体，封装所有服务和处理器
type AppServer struct {
	xiaohongshuService *XiaohongshuService
	mcpServer          *mcp.Server
	router             *gin.Engine
	httpServer         *http.Server
	actualAddr         string
	serveErr           chan error
	listener           net.Listener
	waitOnce           sync.Once
}

// NewAppServer 创建新的应用服务器实例
func NewAppServer(xiaohongshuService *XiaohongshuService) *AppServer {
	appServer := &AppServer{
		xiaohongshuService: xiaohongshuService,
	}

	// 初始化 MCP Server（需要在创建 appServer 之后，因为工具注册需要访问 appServer）
	appServer.mcpServer = InitMCPServer(appServer)

	return appServer
}

// Start 启动服务器
func (s *AppServer) Start(addr string) (string, error) {
	if s.httpServer != nil {
		return "", errors.New("server already started")
	}

	s.router = setupRoutes(s)

	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return "", err
	}

	s.listener = listener
	s.actualAddr = listener.Addr().String()
	s.serveErr = make(chan error, 1)

	s.httpServer = &http.Server{
		Handler: s.router,
	}

	go func() {
		logrus.Infof("启动 HTTP 服务器: %s", s.actualAddr)
		if err := s.httpServer.Serve(listener); err != nil && err != http.ErrServerClosed {
			logrus.Errorf("服务器运行错误: %v", err)
			s.serveErr <- err
			return
		}
		s.serveErr <- nil
	}()

	return s.actualAddr, nil
}

// Wait 等待服务器停止（捕获系统信号或内部错误）
func (s *AppServer) Wait() error {
	if s.httpServer == nil {
		return errors.New("server not started")
	}

	errCh := s.serveErr

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	select {
	case sig := <-quit:
		logrus.Infof("收到信号 %s，正在关闭服务器...", sig)
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := s.httpServer.Shutdown(ctx); err != nil {
			logrus.Warnf("等待连接关闭超时，强制退出: %v", err)
		} else {
			logrus.Infof("服务器已优雅关闭")
		}
		signal.Stop(quit)
		return <-errCh
	case err := <-errCh:
		return err
	}
}

// Shutdown 主动关闭服务器，供桌面应用调用
func (s *AppServer) Shutdown(ctx context.Context) error {
	if s.httpServer == nil {
		return nil
	}

	s.waitOnce.Do(func() {
		if err := s.httpServer.Shutdown(ctx); err != nil {
			logrus.Warnf("主动关闭服务器失败: %v", err)
		}
	})

	return nil
}

// Address 返回服务器实际监听地址（host:port）
func (s *AppServer) Address() string {
	return s.actualAddr
}

// Port 返回服务器监听端口
func (s *AppServer) Port() string {
	if s.actualAddr == "" {
		return ""
	}
	_, port, err := net.SplitHostPort(s.actualAddr)
	if err != nil {
		return ""
	}
	return port
}
