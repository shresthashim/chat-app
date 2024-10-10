import React, { useState, useEffect } from "react";
import styled from "styled-components";
import { Link, useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ChatBubble from "../assets/chat-bubble.png";
import axios from "axios";
import { registerRoute } from "../utils/APIRoutes";

const Register = () => {
  const navigate = useNavigate();
  const [values, setValues] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const toastOptions = {
    position: "bottom-right",
    autoClose: 6000,
    pauseOnHover: true,
    draggable: true,
    theme: "dark",
  };

  useEffect(() => {
    if (localStorage.getItem("chat-app-user")) {
      navigate("/");
    }
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (handleValidation()) {
      const { email, username, password } = values;
      const { data } = await axios.post(registerRoute, {
        username,
        email,
        password,
      });

      if (data.status === false) {
        toast.error(data.msg, toastOptions);
      }
      if (data.status === true) {
        localStorage.setItem("chat-app-user", JSON.stringify(data.user));
        navigate("/");
      }
    }
  };

  const handleValidation = () => {
    const { username, email, password, confirmPassword } = values;
    if (password !== confirmPassword) {
      toast.error("Passwords do not match!", toastOptions);
      return false;
    } else if (username.length < 3) {
      toast.error("Username must be at least 3 characters long!", toastOptions);
      return false;
    } else if (password.length < 6) {
      toast.error("Password must be at least 6 characters long!", toastOptions);
      return false;
    } else if (email === "") {
      toast.error("Email cannot be empty!", toastOptions);
      return false;
    }
    return true;
  };

  const handleChange = (e) => {
    setValues({ ...values, [e.target.name]: e.target.value });
  };

  return (
    <>
      <FormContainer>
        <form onSubmit={(e) => handleSubmit(e)}>
          <div className='brand'>
            <img src={ChatBubble} alt='Logo' />
            <h1>ChatHub</h1>
          </div>
          <input type='text' placeholder='Username' name='username' onChange={(e) => handleChange(e)} />
          <input type='email' placeholder='Email' name='email' onChange={(e) => handleChange(e)} autoComplete='username' />
          <input
            type='password'
            placeholder='Password'
            name='password'
            onChange={(e) => handleChange(e)}
            autoComplete='current-password'
          />
          <input
            type='password'
            placeholder='Confirm Password'
            autoComplete='current-password'
            name='confirmPassword'
            onChange={(e) => handleChange(e)}
          />
          <button type='submit'>Create User</button>
          <span>
            Already have an account? <Link to='/login'>Login</Link>
          </span>
        </form>
      </FormContainer>

      <ToastContainer />
    </>
  );
};

const FormContainer = styled.div`
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1rem;
  align-items: center;
  background: linear-gradient(45deg, #4e0eff, #997af0);

  .brand {
    display: flex;
    align-items: center;
    gap: 1rem;
    justify-content: center;
    img {
      height: 5rem;
    }
    h1 {
      color: #997af0;
      text-transform: uppercase;
      font-weight: bold;
    }
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    background-color: #00000076;
    border-radius: 2rem;
    padding: 3rem 5rem;
    max-width: 400px; /* Limit the width of the form */
    width: 90%; /* Make the form responsive */
  }

  input {
    background: rgba(255, 255, 255, 0.1);
    padding: 1rem;
    border: 0.1rem solid #4e0eff;
    border-radius: 0.4rem;
    color: white;
    width: 100%;
    font-size: 1rem;
    &:focus {
      border: 0.1rem solid #997af0;
      outline: none;
    }
  }

  button {
    background: #4e0eff;
    color: white;
    padding: 1rem 2rem;
    border: none;
    font-weight: bold;
    cursor: pointer;
    border-radius: 0.4rem;
    font-size: 1rem;
    text-transform: uppercase;
    &:hover {
      background-color: #997af0;
    }
  }

  span {
    color: white;
    text-transform: uppercase;
    font-size: 1rem;
    a {
      color: #4e0eff;
      text-decoration: none;
      font-weight: bold;
      &:hover {
        color: #997af0;
      }
    }
  }

  /* Media Queries for Responsiveness */
  @media (max-width: 1024px) {
    form {
      padding: 4rem; /* Adjust padding for medium screens */
    }
  }

  @media (max-width: 768px) {
    form {
      padding: 3rem; /* Adjust padding for smaller screens */
      gap: 1.5rem; /* Reduce gap between inputs */
    }
    .brand {
      flex-direction: column; /* Stack brand elements */
      img {
        height: 4rem; /* Adjust image size */
      }
      h1 {
        font-size: 1.5rem; /* Adjust font size for smaller screens */
      }
    }
    input {
      font-size: 0.9rem; /* Adjust font size for inputs */
    }
    button {
      font-size: 0.9rem; /* Adjust font size for button */
    }
    span {
      font-size: 0.9rem; /* Adjust font size for span */
    }
  }
`;

export default Register;
