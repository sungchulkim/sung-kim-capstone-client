import './MessageItem.css'
import React, { useState } from 'react';
import './MessageItem.css';

const MessageItem = ({ message, currentUser, onEdit, onDelete, onReaction }) => {
    const [isHovered, setIsHovered] = useState(false);
    const isOwnMessage = message.username === currentUser;
    const messageClass = message.isAiMessage ? 'ai-message' : '';

    return (
        <div
            className={`message-item ${isOwnMessage ? 'own-message' : ''} ${messageClass}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <strong>{message.username}: </strong>
            <span>{message.content}</span>
            {isHovered && (
                <div className="message-actions">
                    {isOwnMessage && (
                        <>
                            <button onClick={() => onEdit(message.id)}>Edit</button>
                            <button onClick={() => onDelete(message.id)}>Delete</button>
                        </>
                    )}
                    <div className="reaction-buttons">
                        {['👍', '❤️', '😂', '😮', '😢', '😠'].map((emoji) => (
                            <button key={emoji} onClick={() => onReaction(message.id, emoji)}>
                                {emoji}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {message.reactions && (
                <div className="reactions">
                    {message.reactions.map((reaction, index) => (
                        <span key={index}>{reaction.emoji}</span>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MessageItem;
