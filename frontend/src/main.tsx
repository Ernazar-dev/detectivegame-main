import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider } from "antd";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: "#2563eb",
            colorSuccess: "#16a34a",
            colorWarning: "#eab308",
            colorError: "#dc2626",
            colorInfo: "#2563eb",
            colorBgBase: "#ffffff",
            colorBgLayout: "#f5f6f8",
            colorBgContainer: "#ffffff",
            colorBorder: "#e5e7eb",
            colorText: "#0f172a",
            colorTextSecondary: "#475569",
            borderRadius: 10,
            fontFamily: "Inter, system-ui, -apple-system, sans-serif",
          },
          components: {
            Layout: {
              headerBg: "#ffffff",
              siderBg: "#ffffff",
              bodyBg: "#f5f6f8",
            },
            Menu: {
              itemBg: "#ffffff",
              itemSelectedBg: "#eff6ff",
              itemSelectedColor: "#2563eb",
              itemHoverBg: "#f8fafc",
            },
            Card: { headerBg: "transparent", headerFontSize: 16 },
          },
        }}
      >
        <App />
      </ConfigProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
