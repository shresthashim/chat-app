import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Chat from "./pages/Chat";
import Login from "./pages/Login";
import Register from "./pages/Register";
import SetAvatar from "./pages/SetAvatar";
import { RingLoader } from "react-spinners";

const App = () => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setLoading(false);
    }, 2000);
  }, []);

  return (
    <>
      {loading ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            backgroundColor: "#131324",
          }}
        >
          <RingLoader
       
            color={"#ff9900"}
            loading={loading}
            size={100}
            aria-label='Loading Spinner'
            data-testid='loader'
          />
        </div>
      ) : (
        <BrowserRouter>
          <Routes>
            <Route path='/login' element={<Login />} />
            <Route path='/register' element={<Register />} />
            <Route path='/' element={<Chat />} />
            <Route path='/setAvatar' element={<SetAvatar />} />
          </Routes>
        </BrowserRouter>
      )}
    </>
  );
};

export default App;
