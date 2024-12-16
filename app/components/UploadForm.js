'use client';  // Required for using React hooks in Next.js 13+

import { useState } from 'react';

export default function UploadForm() {
    const [photo, setPhoto] = useState(null);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');

    const handleFileChange = (event) => {
        setPhoto(event.target.files[0]);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!photo || !firstName || !lastName || !email || !password) {
            setMessage('Please fill out all fields and upload a photo.');
            return;
        }

        const formData = new FormData();
        formData.append('photo', photo);
        formData.append('firstName', firstName);
        formData.append('lastName', lastName);
        formData.append('email', email);
        formData.append('password', password);

        try {
            const response = await fetch('/api/uploadPhoto', {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                const result = await response.json();
                setMessage(result.message);  // Backend response
            } else {
                setMessage('Error uploading photo.');
            }
        } catch (error) {
            setMessage('Error uploading photo.');
        }
    };

    return (
        <div className="form-container">
            <h1>Upload Your Photo</h1>
            <form onSubmit={handleSubmit} className="upload-form">
                <input
                    type="text"
                    placeholder="First Name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="input-field"
                />
                <input
                    type="text"
                    placeholder="Last Name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="input-field"
                />
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field"
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field"
                />
                <input
                    type="file"
                    onChange={handleFileChange}
                    className="file-input"
                />
                <button type="submit" className="submit-btn">Upload</button>
            </form>
            {message && <p className="message">{message}</p>}
        </div>
    );
}
