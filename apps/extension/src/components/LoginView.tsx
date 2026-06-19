/**
 * 登录视图组件。
 *
 * 提供邮箱密码登录表单，登录成功后调用 onLogin 回调。
 */

import { useState } from "react";
import { login } from "@/lib/auth.ts";

interface LoginViewProps {
  onLogin: () => void;
}

/**
 * 登录视图。
 */
export function LoginView({ onLogin }: LoginViewProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 处理登录表单提交 */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("请输入邮箱和密码");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await login({ email, password });
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-view">
      <div className="login-icon">D</div>
      <h2>登录 Distill</h2>
      <p>登录后即可一键蒸馏网页内容，自动构建知识图谱</p>

      <form className="login-form" onSubmit={handleSubmit}>
        {error && <div className="login-error">{error}</div>}

        <div className="form-field">
          <label className="label" htmlFor="email">
            邮箱
          </label>
          <input
            id="email"
            className="input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoFocus
          />
        </div>

        <div className="form-field">
          <label className="label" htmlFor="password">
            密码
          </label>
          <input
            id="password"
            className="input"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={loading}
        >
          {loading ? "登录中..." : "登录"}
        </button>
      </form>

      <p className="login-hint">
        还没有账号？请先在{" "}
        <a href="http://localhost:3000/register" target="_blank" rel="noreferrer">
          Web 端注册
        </a>
      </p>
    </div>
  );
}
