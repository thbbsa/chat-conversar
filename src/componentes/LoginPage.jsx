import React, { useState } from "react";
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const navigate = useNavigate();

    const handleChange = (nome) => {
        setUsername(nome);
    };

    const saveNameLocalStorage = () => {
        const trimmed = username.trim();
        if (trimmed === '') {
            alert("Digite um nome para continuar.");
            return;
        }
        localStorage.setItem('username', trimmed);
        navigate('/chat');
    };

    return (
        <div className="d-flex justify-content-center align-items-center vh-100 bg-black">
            <div
                className="rounded-4 p-5 w-100"
                style={{
                    maxWidth: "400px",
                    backgroundColor: "#1a1a2e", // ainda mais escuro
                    boxShadow: "0 0 20px rgba(0, 0, 0, 0.8)"
                }}
            >
                <h2 className="text-center mb-4 fw-bold" style={{ color: "#ccc", letterSpacing: "1px" }}>
                    Entrar no Chat
                </h2>

                <div className="form-group mb-4">
                    <input
                        type="text"
                        className="form-control form-control-lg"
                        style={{
                            backgroundColor: "#12121d",
                            border: "1px solid #333",
                            color: "#ccc",
                            borderRadius: "8px",
                            outline: "none",
                        }}
                        id="username"
                        placeholder="Digite seu nome"
                        value={username}
                        onChange={(e) => handleChange(e.target.value)}
                    />
                </div>

                <button
                    className="btn w-100 btn-lg"
                    style={{
                        backgroundColor: "#3a3aff",
                        border: "none",
                        color: "#ddd",
                        borderRadius: "8px",
                        transition: "background-color 0.2s ease"
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = "#2c2cff"}
                    onMouseOut={(e) => e.target.style.backgroundColor = "#3a3aff"}
                    onClick={saveNameLocalStorage}
                >
                    Entrar
                </button>
            </div>
        </div>
    );
}
