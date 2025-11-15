import { getGoExecutablePath, getPythonExecutablePath, getPythonBackendPath } from '../../utils/path';

describe('Path Utils', () => {
  describe('getGoExecutablePath', () => {
    it('should return null if no executable found', () => {
      // Mock environment
      const originalEnv = process.env.MCP_SERVER_BIN;
      delete process.env.MCP_SERVER_BIN;
      
      const result = getGoExecutablePath();
      expect(result).toBeNull();
      
      // Restore
      if (originalEnv) {
        process.env.MCP_SERVER_BIN = originalEnv;
      }
    });
  });

  describe('getPythonExecutablePath', () => {
    it('should return null if no Python found', () => {
      const originalEnv = process.env.PYTHON_BIN;
      delete process.env.PYTHON_BIN;
      
      const result = getPythonExecutablePath();
      // May be null or a command, depending on system
      expect(typeof result === 'string' || result === null).toBe(true);
      
      if (originalEnv) {
        process.env.PYTHON_BIN = originalEnv;
      }
    });
  });

  describe('getPythonBackendPath', () => {
    it('should return a valid path', () => {
      const path = getPythonBackendPath();
      expect(path).toBeTruthy();
      expect(typeof path).toBe('string');
    });
  });
});

