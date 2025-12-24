const chatBody = document.getElementById('chat-body');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message');
const userNameEl = document.getElementById('user-name');
const newChatBtn = document.getElementById('new-chat');
const logoutLink = document.getElementById('logout-link');
const apiBaseUrl = window.API_BASE_URL || '';
const chatListEl = document.getElementById('chat-list');

const user = JSON.parse(localStorage.getItem('chat_user') || 'null');
let chatId = localStorage.getItem('chat_id');
const DEFAULT_LIMIT = 10;
const chatOffsets = {};
let chatHistoryOffset = null;

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

const renderChatList = (items) => {
  chatListEl.innerHTML = '';
  if (!items || items.length === 0) {
    const empty = document.createElement('span');
    empty.textContent = 'Chưa có lịch sử khác.';
    chatListEl.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent =
      item?.title || item?.summary || `Chat ${item?.chat_id || ''}`.trim();
    button.addEventListener('click', () => {
      if (!item?.chat_id) return;
      chatId = item.chat_id;
      localStorage.setItem('chat_id', chatId);
      chatBody.innerHTML = '';
      loadChat(chatId);
    });
    chatListEl.appendChild(button);
  });
};

const extractOldestCreatedAt = (items) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const sorted = [...items].sort((a, b) => {
    if (!a?.created_at || !b?.created_at) return 0;
    return new Date(a.created_at) - new Date(b.created_at);
  });
  return sorted[0]?.created_at || null;
};

const loadChatHistoryBase = async () => {
  if (!user?.id) return;
  try {
    const url = new URL(`${apiBaseUrl}/chat/chat_history_base`);
    url.searchParams.set('user_id', user.id);
    url.searchParams.set('limit', DEFAULT_LIMIT);
    if (chatHistoryOffset) {
      url.searchParams.set('offset', chatHistoryOffset);
    }
    const response = await fetch(url.toString());
    if (!response.ok) return;
    const payload = await response.json();
    const chats =
      payload?.chats ||
      payload?.items ||
      payload?.data ||
      (Array.isArray(payload) ? payload : []);
    renderChatList(chats);
    chatHistoryOffset = extractOldestCreatedAt(chats);
  } catch (error) {
    renderChatList([]);
  }
};

const loadChat = async (chatIdToLoad) => {
  try {
    const url = new URL(`${apiBaseUrl}/chat/${chatIdToLoad}`);
    url.searchParams.set('limit', DEFAULT_LIMIT);
    if (chatOffsets[chatIdToLoad]) {
      url.searchParams.set('offset', chatOffsets[chatIdToLoad]);
    }
    const response = await fetch(url.toString());
    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    const messages =
      payload?.messages ||
      payload?.items ||
      payload?.data ||
      (Array.isArray(payload) ? payload : []);
    if (Array.isArray(messages)) {
      messages.forEach((msg) => {
        appendMessage(msg.role || 'assistant', msg.content || '');
      });
    }
    const oldest = extractOldestCreatedAt(messages);
    if (oldest) {
      chatOffsets[chatIdToLoad] = oldest;
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
    const endpoint = chatId
      ? `${apiBaseUrl}/message/`
      : `${apiBaseUrl}/message/new_chat_message`;
    const body = chatId
      ? { chat_id: chatId, content }
      : { content, user_id: user?.id };
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error('Hệ thống chưa phản hồi.');
    }

    const payload = await response.json().catch(() => ({}));
    if (!chatId) {
      chatId = payload?.chat_id || payload?.data?.chat_id || chatId;
      if (chatId) {
        localStorage.setItem('chat_id', chatId);
      }
    }
    const reply =
      payload?.reply ||
      payload?.message ||
      payload?.content ||
      payload?.data?.reply ||
      'Mình đã nhận được tin nhắn!';
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
  chatId = '';
  localStorage.removeItem('chat_id');
  appendMessage('assistant', 'Cuộc hội thoại mới đã sẵn sàng.');
});

logoutLink.addEventListener('click', () => {
  localStorage.removeItem('chat_user');
  localStorage.removeItem('chat_id');
});

appendMessage('assistant', 'Xin chào! Hãy bắt đầu nhập câu hỏi của bạn.');
if (chatId) {
  loadChat(chatId);
}
loadChatHistoryBase();
