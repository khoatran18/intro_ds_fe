const chatBody = document.getElementById('chat-body');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message');
const userNameEl = document.getElementById('user-name');
const newChatBtn = document.getElementById('new-chat');
const logoutLink = document.getElementById('logout-link');
const apiBaseUrl = window.API_BASE_URL || '';


const user = JSON.parse(localStorage.getItem('chat_user') || 'null');
let chatId = localStorage.getItem('chat_id');

if (!user) {
  window.location.href = 'index.html';
}

userNameEl.textContent = user ? `Xin chào, ${user.username}` : '';

const appendMessage = (role, content) => {
  const wrapper = document.createElement('div');
  wrapper.className = `chat-message ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'assistant' ? 'AI' : 'You';

  const body = document.createElement('div');
  body.className = 'content';
  body.textContent = content;

  wrapper.appendChild(avatar);
  wrapper.appendChild(body);
  chatBody.appendChild(wrapper);
  chatBody.scrollTop = chatBody.scrollHeight;
};

const loadHistory = async () => {
  if (!chatId) {
    chatId = crypto.randomUUID();
    localStorage.setItem('chat_id', chatId);
  }

  try {
    const response = await fetch(`${apiBaseUrl}/chat/${chatId}`);

    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    if (Array.isArray(payload?.messages)) {
      payload.messages.forEach((msg) => {
        appendMessage(msg.role || 'assistant', msg.content || '');
      });
    }
  } catch (error) {
    appendMessage(
      'assistant',
      'Không thể tải lịch sử chat. Bạn vẫn có thể gửi tin nhắn mới.'
    );
  }
};

const sendMessage = async (content) => {
  appendMessage('user', content);

  try {
    const response = await fetch(`${apiBaseUrl}/chat/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ chat_id: chatId, content }),
    });

    if (!response.ok) {
      throw new Error('Hệ thống chưa phản hồi.');
    }

    const payload = await response.json().catch(() => ({}));
    const reply = payload?.reply || payload?.message || 'Mình đã nhận được tin nhắn!';
    appendMessage('assistant', reply);
  } catch (error) {
    appendMessage('assistant', error.message || 'Có lỗi khi gửi tin nhắn.');
  }
};

chatForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const content = messageInput.value.trim();
  if (!content) return;
  messageInput.value = '';
  sendMessage(content);
});

messageInput.addEventListener('input', () => {
  messageInput.style.height = 'auto';
  messageInput.style.height = `${messageInput.scrollHeight}px`;
});

newChatBtn.addEventListener('click', () => {
  chatBody.innerHTML = '';
  chatId = crypto.randomUUID();
  localStorage.setItem('chat_id', chatId);
  appendMessage('assistant', 'Cuộc hội thoại mới đã sẵn sàng.');
});

logoutLink.addEventListener('click', () => {
  localStorage.removeItem('chat_user');
  localStorage.removeItem('chat_id');
});

appendMessage('assistant', 'Xin chào! Hãy bắt đầu nhập câu hỏi của bạn.');
loadHistory();
