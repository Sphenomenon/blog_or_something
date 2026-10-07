import App from "../src/App.jsx";
import { SiteFonts } from "../src/components/SiteFonts.jsx";
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
  </head><body><SiteFonts /><App>{children}</App></body></html>;
}
