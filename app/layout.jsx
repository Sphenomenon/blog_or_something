import App from "../src/App.jsx";
import "../src/styles.css";

export const metadata = {
  title: { default: "失眠档案馆 · Nocturne Archive", template: "%s · 失眠档案馆" },
  description: "清醒的档案系统，记录一场正在腐朽的梦。",
  icons: { icon: "/logo.ico" }
};

export default function RootLayout({ children }) {
  return <html lang="zh-Hans"><head>
    <link rel="preconnect" href="https://fonts.loli.net" />
    <link rel="preconnect" href="https://gstatic.loli.net" crossOrigin="anonymous" />
    <link rel="stylesheet" href="https://fonts.loli.net/css2?family=JetBrains+Mono:wght@400;500&family=Noto+Sans+SC:wght@400;500;700&family=Noto+Serif+SC:wght@400;500;700&display=swap" />
  </head><body><App>{children}</App></body></html>;
}
