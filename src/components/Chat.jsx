import './Chat.css';
import React, { useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import MessageItem from './MessageItem';

const SERVER_URL = import.meta.env.VITE_SERVER_URL;

function Chat() {
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [currentUser, setCurrentUser] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [roomId, setRoomId] = useState(1); // Default room ID is 1
    const [error, setError] = useState(null);
    const [socket, setSocket] = useState(null);

    // Fetch Messages
    const fetchMessages = useCallback(async () => {
        try {
            const response = await axios.get(`${SERVER_URL}/rooms/${roomId}/messages`);
            console.log('Fetched messages:', response.data);
            setMessages(response.data);
            setError(null); // Clear any previous errors
        } catch (error) {
            console.error('Error fetching messages:', error);
            setError('Failed to fetch messages. Please try again.');
        }
    }, [roomId]);

    // Fetch Current User
    const fetchCurrentUser = useCallback(async () => {
        try {
            const response = await axios.get(`${SERVER_URL}/current-user`);
            console.log('Current user:', response.data);
            setCurrentUser(response.data.username);
            setIsAuthenticated(true);
            setError(null); // Clear any previous errors
        } catch (error) {
            console.error('Error fetching current user:', error);
            setIsAuthenticated(false);
            setError('Failed to authenticate. Please log in again.');
        }
    }, []);

    // Initialize Socket Connection
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            setIsAuthenticated(false);
            return;
        }

        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        fetchCurrentUser();
        fetchMessages();

        const newSocket = io(SERVER_URL, {
            auth: {
                token: `Bearer ${token}`
            }
        });

        // Connection Logs
        newSocket.on('connect', () => {
            console.log('Socket connected:', newSocket.id);
        });

        newSocket.on('connect_error', (err) => {
            console.error('Socket connection error:', err.message);
        });

        newSocket.on('disconnect', () => {
            console.log('Socket disconnected:', newSocket.id);
        });

        setSocket(newSocket);

        return () => {
            if (newSocket) newSocket.disconnect();
        };
    }, [fetchCurrentUser, fetchMessages]);

    // Handle Socket Events
    useEffect(() => {
        if (!socket) return;

        // Join Room
        socket.emit('joinRoom', roomId.toString());
        console.log(`Emitted 'joinRoom' for room: ${roomId}`);

        // Event Handlers
        const handleNewMessage = (newMessage) => {
            console.log('Received new message via socket:', newMessage);
            if (newMessage.room_id === parseInt(roomId)) {
                setMessages((prevMessages) => [...prevMessages, newMessage]);
            }
        };

        const handleMessageEdited = ({ messageId, content, roomId: eventRoomId }) => {
            console.log('Received messageEdited via socket:', { messageId, content, eventRoomId });
            console.log('Current roomId:', roomId);
            if (eventRoomId === parseInt(roomId)) {
                setMessages((prevMessages) => {
                    console.log('Previous messages:', prevMessages);
                    const newMessages = prevMessages.map((msg) => {
                        // Convert both to the same type (number) before comparison
                        if (Number(msg.id) === Number(messageId)) {
                            console.log(`Updating message ${msg.id}`);
                            return { ...msg, content };
                        }
                        return msg;
                    });
                    console.log('Updated messages:', newMessages);
                    return newMessages;
                });
            } else {
                console.log('Room ID mismatch, not updating messages');
            }
        };

        const handleMessageDeleted = ({ messageId, roomId: eventRoomId }) => {
            console.log('Received messageDeleted via socket:', { messageId, eventRoomId });
            if (eventRoomId === parseInt(roomId)) {
                setMessages((prevMessages) => prevMessages.filter((msg) => Number(msg.id) !== Number(messageId)));
            }
        };

        const handleReaction = ({ messageId, userId, emoji, roomId: eventRoomId }) => {
            console.log('Received reaction via socket:', { messageId, userId, emoji, eventRoomId });
            if (eventRoomId === parseInt(roomId)) {
                setMessages((prevMessages) =>
                    prevMessages.map((msg) =>
                        // msg.id === messageId: data type mismatch!
                Number(msg.id) === Number(messageId)
                            ? { ...msg, reactions: [...(msg.reactions || []), { userId, emoji }] }
                            : msg
                    )
                );
            }
        };

        // Register Event Listeners
        socket.on('message', handleNewMessage);
        socket.on('messageEdited', handleMessageEdited);
        socket.on('messageDeleted', handleMessageDeleted);
        socket.on('reaction', handleReaction);
        socket.on('joinedRoom', (roomId) => {
            console.log(`Successfully joined room: ${roomId}`);
        });

        // Cleanup on Unmount or Room Change
        return () => {
            console.log(`Emitting 'leaveRoom' for room: ${roomId}`);
            // console.log('Leaving room:', roomId);
            socket.emit('leaveRoom', roomId.toString());
            socket.off('message', handleNewMessage);
            socket.off('messageEdited', handleMessageEdited);
            socket.off('messageDeleted', handleMessageDeleted);
            socket.off('reaction', handleReaction);
        };
    }, [socket, roomId]);

    // Handlers
    const sendMessage = async () => {
        if (inputMessage.trim() !== '') {
            try {
                const response = await axios.post(`${SERVER_URL}/messages`, {
                    content: inputMessage,
                    roomId: roomId
                });
                console.log('Sent message:', response.data);
                setInputMessage('');
                // Optimistically update messages
                // setMessages((prevMessages) => [...prevMessages, response.data]);
            } catch (error) {
                console.error('Error sending message:', error);
                setError('Failed to send message. Please try again.');
            }
        }
    };

    const deleteMessage = useCallback(async (messageId) => {
        try {
            await axios.delete(`${SERVER_URL}/messages/${messageId}`);
            // The socket event handles updating UI
        } catch (error) {
            console.error('Error deleting message:', error);
            setError('Failed to delete message. Please try again.');
        }
    }, []);

    const addReaction = useCallback(async (messageId, emoji) => {
        try {
            await axios.post(`${SERVER_URL}/messages/${messageId}/reactions`, {
                emoji,
            });
            // The socket event handles updating UI
        } catch (error) {
            console.error('Error adding reaction:', error);
            setError('Failed to add reaction. Please try again.');
        }
    }, []);

    const editMessage = useCallback((messageId) => {
        const messageToEdit = messages.find((msg) => msg.id === messageId);
        if (messageToEdit) {
            setEditingMessageId(messageId);
            setInputMessage(messageToEdit.content);
        }
    }, [messages]);

    const saveEditedMessage = useCallback(async () => {
        if (inputMessage.trim() && editingMessageId) {
            try {
                await axios.put(`${SERVER_URL}/messages/${editingMessageId}`, {
                    content: inputMessage,
                });
                setEditingMessageId(null);
                setInputMessage('');
                // The socket event handles updating UI
            } catch (error) {
                console.error('Error editing message:', error);
                setError('Failed to edit message. Please try again.');
            }
        }
    }, [inputMessage, editingMessageId]);

    const handleAiChat = async () => {
        if (inputMessage.trim() === '') return;
        try {
            const response = await axios.post(`${SERVER_URL}/api/chat`, { message: inputMessage });
            const aiReply = response.data.reply;
            const newMessage = {
                id: Date.now(), // Temp ID; real ID should come from the server
                username: 'AI Assistant',
                content: aiReply,
                isAiMessage: true,
                reactions: []
            };
            setMessages(prevMessages => [...prevMessages, newMessage]);
            setInputMessage('');
        } catch (error) {
            console.error('Error with AI chat:', error);
            setError('Failed to get AI response. Please try again.');
        }
    };

    const addMessage = (username, content) => {
        const newMessage = {
            id: Date.now(),
            username,
            content,
            reactions: []
        };
        setMessages((prevMessages) => [...prevMessages, newMessage]);
    };

    if (!isAuthenticated) {
        return <div>Please log in to access the chat. {error && <p>{error}</p>}</div>;
    }

    return (
        <div className="chat-container">
            <h4 className='chat-room__heading' >Chat Room: {roomId}</h4>
            {error && <p className="error-message">{error}</p>}

            <div className="messages-container">
                {messages.map((message) => (
                    <MessageItem
                        key={message.id}
                        message={message}
                        currentUser={currentUser}
                        onEdit={editMessage}
                        onDelete={deleteMessage}
                        onReaction={addReaction}
                    />
                ))}
            </div>

            <div className="input-container">
                <span className="current-user">{currentUser}: </span>
                <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder={editingMessageId ? "Edit your message..." : "Type a message..."}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            if (editingMessageId) {
                                saveEditedMessage();
                            } else {
                                sendMessage();
                            }
                        }
                    }}
                />
                {editingMessageId ? (
                    <button className='save-edit__button' onClick={saveEditedMessage}>Save Edit</button>
                ) : (
                    <button className='send__button' onClick={sendMessage}>SEND</button>
                )}
                <button className="ask-ai__button" onClick={handleAiChat}>Ask AI</button>
            </div>
        </div>
    );
}

export default Chat;