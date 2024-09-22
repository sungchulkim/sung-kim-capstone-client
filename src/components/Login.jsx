import './Auth.css'
import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import chatIcon from '../assets/chat-auth.svg'

const SERVER_URL = import.meta.env.VITE_SERVER_URL

function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post(`${SERVER_URL}/login`, { username, password });
            localStorage.setItem('token', response.data.token);
            navigate('/chat');
        } catch (error) {
            console.error('Login failed:', error);
        }
    };

    return (
        <div className="auth-container">
            <form onSubmit={handleSubmit} className="auth-form">
                <img src={chatIcon} alt="Login" className="auth-image" />
                <h2>Login</h2>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" required />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />
                <button type="submit">Login</button>
            </form>
        </div>
    );
}

export default Login;