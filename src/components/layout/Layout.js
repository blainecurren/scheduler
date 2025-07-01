import React from "react";
import Header from "./Header/Header";
import Sidebar from "./Sidebar/Sidebar";
import Footer from "./Footer/Footer";

const Layout = ({ children }) => {
  return (
    <div className="app-layout">
      <Header />
      <div className="app-container">
        <Sidebar />
        <main className="app-main">{children}</main>
      </div>
      <Footer />
    </div>
  );
};

export default Layout;
