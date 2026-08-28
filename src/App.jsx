import React, { useState, useEffect, useRef, useMemo } from "react";
import { io } from "socket.io-client";
import {
  MessageCircle, Send, Users, LogOut, Hash, Plus, Circle,
} from "lucide-react";

// ---- Backend connection ----
// Make sure the Node.js backend (chatwave-backend) is running on port 4000
// before joining a room.
const SOCKET_URL = "http://localhost:4000";

const DEFAULT_ROOMS = ["General", "Random", "Tech Talk", "Gaming"];

function getInitials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function avatarColor(name) {
  const colors = ["#3E5C76", "#4C7A51", "#B23A48", "#8A5A3B", "#6B5B95"];
  let hash = 0;
  for (const ch of name) hash = ch.charCodeAt(0) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function JoinScreen({ onJoin }) {
  const [username, setUsername] = useState("");
  const [room, setRoom] = useState(DEFAULT_ROOMS[0]);
  const [customRoom, setCustomRoom] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [error, setError] = useState("");

  const submit = (e) => {
    e.preventDefault();
    const finalRoom = useCustom ? customRoom.trim() : room;
    if (!username.trim()) {
      setError("Enter a display name to continue.");
      return;
    }
    if (!finalRoom) {
      setError("Pick a room or type a custom room name.");
      return;
    }
    setError("");
    onJoin({ username: username.trim(), room: finalRoom });
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#161A22", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 24,
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 28 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, background: "#5CC9A7",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <MessageCircle size={22} color="#0E1116" strokeWidth={2.3} />
          </div>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 24, color: "#F2F3F5" }}>
            ChatWave
          </span>
        </div>

        <div style={{
          background: "#1E232D", border: "1px solid #2C323F", borderRadius: 14, padding: "30px 28px",
        }}>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 19, color: "#F2F3F5", margin: "0 0 4px" }}>
            Join a room
          </h1>
          <p style={{ fontSize: 13, color: "#8B93A3", margin: "0 0 22px" }}>
            Pick a display name and a room to start chatting in real time.
          </p>

          <form onSubmit={submit}>
            <label style={labelStyle}>Display name</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. Yuvraj"
              style={inputStyle}
            />

            <label style={{ ...labelStyle, marginTop: 16 }}>Room</label>
            {!useCustom ? (
              <select value={room} onChange={(e) => setRoom(e.target.value)} style={inputStyle}>
                {DEFAULT_ROOMS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            ) : (
              <input
                value={customRoom}
                onChange={(e) => setCustomRoom(e.target.value)}
                placeholder="Type a room name"
                style={inputStyle}
              />
            )}
            <button
              type="button"
              onClick={() => setUseCustom(!useCustom)}
              style={{
                background: "none", border: "none", color: "#5CC9A7", fontSize: 12,
                fontWeight: 600, cursor: "pointer", padding: "6px 0 0", display: "flex",
                alignItems: "center", gap: 4,
              }}
            >
              <Plus size={13} />
              {useCustom ? "Choose from existing rooms instead" : "Create a custom room"}
            </button>

            {error && <p style={{ color: "#E27878", fontSize: 13, margin: "14px 0 0" }}>{error}</p>}

            <button type="submit" style={{
              width: "100%", marginTop: 22, background: "#5CC9A7", color: "#0E1116",
              border: "none", borderRadius: 8, padding: "12px 0", fontSize: 15,
              fontWeight: 700, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif",
            }}>
              Join room
            </button>
          </form>

          <p style={{ fontSize: 11, color: "#5B6272", textAlign: "center", marginTop: 16 }}>
            Make sure the backend server is running on http://localhost:4000
          </p>
        </div>
      </div>
    </div>
  );
}

function ChatScreen({ username, room, onLeave }) {
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [draft, setDraft] = useState("");
  const [connected, setConnected] = useState(false);

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join-room", { username, room });
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on("chat-history", (history) => setMessages(history));

    socket.on("new-message", (message) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on("system-message", (text) => {
      setMessages((prev) => [...prev, { id: `sys-${Date.now()}`, system: true, text }]);
    });

    socket.on("presence-update", (users) => setOnlineUsers(users));

    socket.on("user-typing", (name) => {
      setTypingUsers((prev) => (prev.includes(name) ? prev : [...prev, name]));
    });

    socket.on("user-stop-typing", (name) => {
      setTypingUsers((prev) => prev.filter((u) => u !== name));
    });

    return () => {
      socket.disconnect();
    };
  }, [username, room]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleDraftChange = (value) => {
    setDraft(value);
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit("typing");
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stop-typing");
    }, 1200);
  };

  const sendMessage = (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !socketRef.current) return;
    socketRef.current.emit("send-message", text);
    socketRef.current.emit("stop-typing");
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setDraft("");
  };

  const typingLabel = useMemo(() => {
    const others = typingUsers.filter((u) => u !== username);
    if (others.length === 0) return "";
    if (others.length === 1) return `${others[0]} is typing...`;
    if (others.length === 2) return `${others[0]} and ${others[1]} are typing...`;
    return "Several people are typing...";
  }, [typingUsers, username]);

  return (
    <div style={{ display: "flex", height: "100vh", background: "#161A22", fontFamily: "'Inter', sans-serif" }}>
      {/* Sidebar */}
      <div style={{
        width: 240, background: "#1E232D", borderRight: "1px solid #2C323F",
        display: "flex", flexDirection: "column", flexShrink: 0,
      }}>
        <div style={{ padding: "18px 18px 14px", borderBottom: "1px solid #2C323F" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8, background: "#5CC9A7",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <MessageCircle size={16} color="#0E1116" strokeWidth={2.3} />
            </div>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: "#F2F3F5" }}>
              ChatWave
            </span>
          </div>
        </div>

        <div style={{ padding: "16px 18px 8px", display: "flex", alignItems: "center", gap: 6, color: "#8B93A3" }}>
          <Hash size={14} />
          <span style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em" }}>
            {room}
          </span>
        </div>

        <div style={{ padding: "8px 18px", flex: 1, overflowY: "auto" }}>
          <p style={{
            fontSize: 11, color: "#5B6272", fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.04em", margin: "8px 0 10px", display: "flex", alignItems: "center", gap: 6,
          }}>
            <Users size={12} /> Online — {onlineUsers.length}
          </p>
          {onlineUsers.map((u) => (
            <div key={u} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
              <div style={{
                width: 26, height: 26, borderRadius: "50%", background: avatarColor(u),
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0,
              }}>
                {getInitials(u)}
              </div>
              <span style={{ fontSize: 13, color: u === username ? "#5CC9A7" : "#D5D8DE" }}>
                {u}{u === username ? " (you)" : ""}
              </span>
              <Circle size={7} fill="#5CC9A7" color="#5CC9A7" style={{ marginLeft: "auto" }} />
            </div>
          ))}
        </div>

        <div style={{ padding: 16, borderTop: "1px solid #2C323F", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: "50%", background: avatarColor(username),
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0,
          }}>
            {getInitials(username)}
          </div>
          <span style={{ fontSize: 13, color: "#F2F3F5", flex: 1 }}>{username}</span>
          <button onClick={onLeave} title="Leave room" style={{
            background: "none", border: "none", cursor: "pointer", color: "#8B93A3",
            display: "flex", alignItems: "center",
          }}>
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Main chat area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{
          padding: "14px 24px", borderBottom: "1px solid #2C323F", display: "flex",
          alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#F2F3F5", fontFamily: "'Space Grotesk', sans-serif" }}>
              #{room}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: connected ? "#5CC9A7" : "#E27878" }}>
              {connected ? "Connected" : "Reconnecting..."}
            </p>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "18px 24px", display: "flex", flexDirection: "column", gap: 4 }}>
          {messages.map((m) =>
            m.system ? (
              <div key={m.id} style={{ textAlign: "center", margin: "8px 0" }}>
                <span style={{ fontSize: 12, color: "#5B6272", background: "#1E232D", padding: "4px 12px", borderRadius: 999 }}>
                  {m.text}
                </span>
              </div>
            ) : (
              <div
                key={m.id}
                style={{
                  display: "flex", flexDirection: "column",
                  alignItems: m.username === username ? "flex-end" : "flex-start", margin: "6px 0",
                }}
              >
                <span style={{ fontSize: 11, color: "#5B6272", margin: "0 0 3px" }}>
                  {m.username === username ? "You" : m.username} · {formatTime(m.time)}
                </span>
                <div style={{
                  maxWidth: "60%", padding: "9px 14px", borderRadius: 14,
                  background: m.username === username ? "#5CC9A7" : "#242A36",
                  color: m.username === username ? "#0E1116" : "#F2F3F5",
                  fontSize: 14, lineHeight: 1.45, wordBreak: "break-word",
                  borderBottomRightRadius: m.username === username ? 4 : 14,
                  borderBottomLeftRadius: m.username === username ? 14 : 4,
                }}>
                  {m.text}
                </div>
              </div>
            )
          )}
          <div ref={messagesEndRef} />
        </div>

        <div style={{ padding: "6px 24px", height: 20 }}>
          {typingLabel && (
            <span style={{ fontSize: 12, color: "#8B93A3", fontStyle: "italic" }}>{typingLabel}</span>
          )}
        </div>

        <form onSubmit={sendMessage} style={{
          padding: "12px 24px 20px", display: "flex", gap: 10, alignItems: "center",
        }}>
          <input
            value={draft}
            onChange={(e) => handleDraftChange(e.target.value)}
            placeholder={`Message #${room}`}
            style={{
              flex: 1, background: "#1E232D", border: "1px solid #2C323F", borderRadius: 10,
              padding: "12px 16px", fontSize: 14, color: "#F2F3F5", outline: "none",
            }}
          />
          <button type="submit" style={{
            background: "#5CC9A7", border: "none", borderRadius: 10, width: 42, height: 42,
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0,
          }}>
            <Send size={17} color="#0E1116" />
          </button>
        </form>
      </div>
    </div>
  );
}

const labelStyle = { fontSize: 12, fontWeight: 600, color: "#D5D8DE", display: "block", marginBottom: 6 };
const inputStyle = {
  width: "100%", boxSizing: "border-box", padding: "10px 12px", background: "#161A22",
  border: "1px solid #2C323F", borderRadius: 8, fontSize: 14, color: "#F2F3F5", outline: "none",
};

export default function App() {
  const [session, setSession] = useState(null); // { username, room }

  return (
    <div style={{ background: "#161A22", minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap');
        * { font-family: 'Inter', sans-serif; }
        input:focus, select:focus { border-color: #5CC9A7 !important; }
        button { transition: opacity 0.15s ease; }
        button:hover { opacity: 0.85; }
        ::placeholder { color: #5B6272; }
      `}</style>
      {!session ? (
        <JoinScreen onJoin={setSession} />
      ) : (
        <ChatScreen username={session.username} room={session.room} onLeave={() => setSession(null)} />
      )}
    </div>
  );
}