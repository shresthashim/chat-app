import React, { useState, useEffect } from "react";
import styled from "styled-components";
import Cat from "../assets/cat.gif";
import Logout from "./Logout";
const Welcome = () => {
  const [userName, setUserName] = useState("");
  useEffect(() => {
    const getUserName = async () => {
      setUserName(await JSON.parse(localStorage.getItem("chat-app-user")).username);
    };
    getUserName();
  }, []);
  return (
    <Container>
      <div className="logout">
     <h2>Logout</h2> <Logout/>
     </div>
      <img src={Cat} alt='Cat Image' />
      <h1>
        Hey, <span>{userName}!</span>
    
      </h1>
      <h2>Welcome to ChatHub!</h2>
      <h4>Start Messaging with your friends!</h4>
    </Container>
  );
};

export default Welcome;
const Container = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  color: white;
  flex-direction: column;
  img {
    height: 20rem;
  }
  span {
    color: #4e0eff;
  }
  .logout{
    display: flex;
    margin-left: 60%;
    align-items: center;
  }
  h2{
    color: white;
    margin-right: 0.5rem;
    margin-top:1rem;
  }
  h4{
    margin-top: 0.5rem;
    color : gray;
    font-size: 1.5rem;
  }
`;
