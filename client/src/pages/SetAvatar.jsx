import React, { useEffect, useState } from "react";
import styled from "styled-components";
import axios from "axios";
import { Buffer } from "buffer";
import loader from "../assets/loader.svg";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate } from "react-router-dom";
import { setAvatarRoute } from "../utils/APIRoutes";

const SetAvatar = () => {
  const api = `https://api.multiavatar.com/4645646`;
  const navigate = useNavigate();
  const [avatars, setAvatars] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAvatar, setSelectedAvatar] = useState(undefined);

  const toastOptions = {
    position: "bottom-right",
    autoClose: 8000,
    pauseOnHover: true,
    draggable: true,
    theme: "dark",
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!localStorage.getItem("chat-app-user")) {
        navigate("/login");
        return;
      }
    };
    fetchData();
  }, [navigate]);

  const setProfilePicture = async () => {
    if (selectedAvatar === undefined) {
      toast.error("Please select an avatar", toastOptions);
    } else {
      const user = await JSON.parse(localStorage.getItem("chat-app-user"));
      const { data } = await axios.post(`${setAvatarRoute}/${user._id}`, {
        image: avatars[selectedAvatar],
      });

      if (data.isSet) {
        user.isAvatarImageSet = true;
        user.avatarImage = data.image;
        localStorage.setItem("chat-app-user", JSON.stringify(user));
        navigate("/");
      } else {
        toast.error("Error setting avatar. Please try again.", toastOptions);
      }
    }
  };

  useEffect(() => {
    const fetchAvatars = async () => {
      const data = [];
      for (let i = 0; i < 4; i++) {
        const image = await axios.get(`${api}/${Math.round(Math.random() * 1000)}`);
        const buffer = new Buffer(image.data);
        data.push(buffer.toString("base64"));
      }
      setAvatars(data);
      setIsLoading(false);
    };

    fetchAvatars();
  }, [api]);

  return (
    <>
      {isLoading ? (
        <Container>
          <img src={loader} alt='loader' className='loader' />
        </Container>
      ) : (
        <Container>
          <div className='title-container'>
            <h1>Pick an Avatar as your profile picture</h1>
          </div>
          <div className='avatars'>
            {avatars.map((avatar, index) => (
              <div key={index} className={`avatar ${selectedAvatar === index ? "selected" : ""}`}>
                <img
                  src={`data:image/svg+xml;base64,${avatar}`}
                  alt='avatar'
                  onClick={() => setSelectedAvatar(index)}
                />
              </div>
            ))}
          </div>
          <button onClick={setProfilePicture} className='submit-btn'>
            Set as Profile Picture
          </button>
          <ToastContainer />
        </Container>
      )}
    </>
  );
};

export default SetAvatar;

const Container = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  gap: 3rem;
  background: linear-gradient(45deg, #4e0eff, #997af0);
  height: 100vh;
  width: 100vw;

  .loader {
    max-inline-size: 100%;
  }

  .title-container {
    h1 {
      color: white;
      font-size: 2rem;
      font-weight: bold;
    }
  }

  .avatars {
    display: flex;
    gap: 2rem;

    .avatar {
      border: 0.4rem solid transparent;
      padding: 0.4rem;
      border-radius: 5rem;
      display: flex;
      justify-content: center;
      align-items: center;
      transition: 0.5s ease-in-out;

      img {
        height: 6rem;
        transition: 0.5s ease-in-out;
        border-radius: 5rem;
      }
    }

    .selected {
      border: 0.4rem solid #4e0eff;
    }
  }

  .submit-btn {
    background-color: #4e0eff;
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

  /* Media Queries for Responsiveness */
  @media (max-width: 1024px) {
    .avatars {
      gap: 1.5rem; /* Reduce gap between avatars for medium screens */
    }

    .title-container h1 {
      font-size: 1.8rem; /* Reduce font size for medium screens */
    }
  }

  @media (max-width: 768px) {
    .avatars {
      flex-wrap: wrap; /* Allow avatars to wrap */
      gap: 1rem; /* Reduce gap further for smaller screens */
    }

    .avatar img {
      height: 4rem; /* Adjust avatar size for smaller screens */
    }

    .title-container h1 {
      font-size: 1.5rem; /* Adjust font size for smaller screens */
    }

    .submit-btn {
      font-size: 0.9rem; /* Adjust button font size for smaller screens */
      padding: 0.8rem 1.5rem; /* Adjust button padding */
    }
  }

  @media (max-width: 480px) {
    .avatars {
      gap: 0.5rem; /* Minimal gap for mobile devices */
    }

    .avatar img {
      height: 3.5rem; /* Smaller avatars for mobile screens */
    }

    .title-container h1 {
      font-size: 1.2rem; /* Smaller title for mobile screens */
      text-align: center; /* Center the text */
    }

    .submit-btn {
      font-size: 0.8rem; /* Smaller button font size */
      padding: 0.6rem 1rem; /* Adjust padding for smaller screens */
    }
  }
`;
