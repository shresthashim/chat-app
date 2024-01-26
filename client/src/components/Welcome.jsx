import React, { useState, useEffect } from "react";
import styled from "styled-components";
import Cat from "../assets/cat.gif";
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
      <img src={Cat} alt='Cat Image' />
      <h1>
        Hey, <span>{userName}!</span>
      </h1>
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
`;
