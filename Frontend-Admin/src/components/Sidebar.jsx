import React, { useState, useContext } from "react";
import { TiHome } from "react-icons/ti";
import { RiLogoutBoxFill } from "react-icons/ri";
import { AiFillMessage } from "react-icons/ai";
import { GiHamburgerMenu } from "react-icons/gi";
import { FaUserDoctor } from "react-icons/fa6";
import { MdAddModerator } from "react-icons/md";
import { IoPersonAddSharp } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "axios";
import { Context } from "../main";
import "./Sidebar.css";

const Sidebar = () => {
  const [show, setShow] = useState(false);
  const navigateTo = useNavigate();
  const { setIsAuthenticated } = useContext(Context);

  const gotoHome = () => {
    navigateTo("/");
    setShow(false);
  };

  const gotoDoctors = () => {
    navigateTo("/doctors");
    setShow(false);
  };

  const gotoMessages = () => {
    navigateTo("/messages");
    setShow(false);
  };

  const gotoAddNewDoctor = () => {
    navigateTo("/doctor/addnew");
    setShow(false);
  };

  const gotoAddNewAdmin = () => {
    navigateTo("/admin/addnew");
    setShow(false);
  };

  const handleLogout = async () => {
    try {
      const res = await axios.get("http://localhost:4000/api/v1/user/admin/logout", {
        withCredentials: true,
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });
      toast.success(res.data.message || "Logged out successfully!");
      // Update auth state and redirect
      setIsAuthenticated(false);
      navigateTo("/login"); // redirect to login page
    } catch (err) {
      toast.error(err.response?.data?.message || "Logout failed");
    }
  };

  return (
    <>
      <nav className={show ? "show sidebar" : "sidebar"}>
        <div className="links">
          <TiHome onClick={gotoHome} />
          <FaUserDoctor onClick={gotoDoctors} />
          <MdAddModerator onClick={gotoAddNewAdmin} />
          <IoPersonAddSharp onClick={gotoAddNewDoctor} />
          <AiFillMessage onClick={gotoMessages} />
          <RiLogoutBoxFill onClick={handleLogout} />
        </div>
      </nav>
      <div className="wrapper">
        <GiHamburgerMenu className="hamburger" onClick={() => setShow(!show)} />
      </div>
    </>
  );
};

export default Sidebar;
