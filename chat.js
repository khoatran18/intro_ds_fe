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
const chatStates = {};
let chatHistoryOffset = null;
let chatHistoryLoading = false;
let chatHistoryDone = false;
let chatHistoryItems = [];
let chatHistoryRequestCount = 0;
let chatRequestCount = 0;

if (!user) {
  window.location.href = 'index.html';
}

userNameEl.textContent = user ? `Xin chào, ${user.username}` : '';

const appendMessage = (role, content) => {
  const wrapper = document.createElement('div');
  wrapper.className = `chat-message ${role}`;

  const body = document.createElement('div');
  body.className = 'content';
  body.textContent = content;

  wrapper.appendChild(body);
  chatBody.appendChild(wrapper);
  chatBody.scrollTop = chatBody.scrollHeight;
};

const sortByCreatedAtAsc = (items) =>
  [...items].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

const sortByCreatedAtDesc = (items) =>
  [...items].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

const getChatState = (id) => {
  if (!chatStates[id]) {
    chatStates[id] = { offset: null, loading: false, done: false };
  }
  return chatStates[id];
};

const setActiveChat = (nextChatId) => {
  chatId = nextChatId || '';
  if (chatId) {
    localStorage.setItem('chat_id', chatId);
  } else {
    localStorage.removeItem('chat_id');
  }
  const buttons = chatListEl.querySelectorAll('button[data-chat-id]');
  buttons.forEach((button) => {
    button.classList.toggle('active', button.dataset.chatId === chatId);
  });
};

const renderChatList = (items, append = false) => {
  const previousHeight = chatListEl.scrollHeight;
  const previousScroll = chatListEl.scrollTop;
  if (append) {
    const existing = new Map(
      chatHistoryItems.map((item) => [item.chat_id, item])
    );
    items.forEach((item) => {
      if (item?.chat_id && !existing.has(item.chat_id)) {
        chatHistoryItems.push(item);
      }
    });
  } else {
    chatHistoryItems = items;
  }
  chatListEl.innerHTML = '';
  if (!chatHistoryItems || chatHistoryItems.length === 0) {
    const empty = document.createElement('span');
    empty.textContent = 'Chưa có lịch sử khác.';
    chatListEl.appendChild(empty);
    return;
  }

  sortByCreatedAtDesc(chatHistoryItems).forEach((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.chatId = item?.chat_id || '';
    button.textContent =
      item?.title || item?.summary || `Chat ${item?.chat_id || ''}`.trim();
    button.addEventListener('click', () => {
      if (!item?.chat_id) return;
      setActiveChat(item.chat_id);
      chatBody.innerHTML = '';
      loadChat(chatId, { reset: true });
    });
    chatListEl.appendChild(button);
  });
  setActiveChat(chatId);
  if (append) {
    chatListEl.scrollTop =
      previousScroll + (chatListEl.scrollHeight - previousHeight);
  }
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
  if (chatHistoryLoading || chatHistoryDone) return;
  chatHistoryLoading = true;
  try {
    chatHistoryRequestCount += 1;
    const url = new URL(`${apiBaseUrl}/chat/chat_history_base`);
    url.searchParams.set('user_id', user.id);
    url.searchParams.set('limit', DEFAULT_LIMIT);
    if (chatHistoryOffset) {
      url.searchParams.set('offset', chatHistoryOffset);
    }
    console.log('[chat_history_base] request', {
      id: chatHistoryRequestCount,
      url: url.toString(),
      offset: chatHistoryOffset,
      limit: DEFAULT_LIMIT,
      user_id: user.id,
    });
    const response = await fetch(url.toString());
    console.log('[chat_history_base] response', {
      id: chatHistoryRequestCount,
      status: response.status,
      ok: response.ok,
    });
    if (!response.ok) return;
    const payload = await response.json();
    const chats = payload?.chat_history || [];
    console.log('[chat_history_base] payload', {
      id: chatHistoryRequestCount,
      count: chats.length,
      oldest_created_at: extractOldestCreatedAt(chats),
    });
    if (chats.length === 0 && chatHistoryOffset) {
      chatHistoryDone = true;
      return;
    }
    renderChatList(chats, Boolean(chatHistoryOffset));
    chatHistoryOffset =
      extractOldestCreatedAt(chatHistoryItems) || chatHistoryOffset;
  } catch (error) {
    console.error('[chat_history_base] error', error);
    renderChatList([]);
  } finally {
    chatHistoryLoading = false;
  }
};

const renderMessages = (messages, prepend = false) => {
  if (!Array.isArray(messages) || messages.length === 0) return;
  const ordered = sortByCreatedAtAsc(messages);
  const previousHeight = chatBody.scrollHeight;
  const items = prepend ? [...ordered].reverse() : ordered;
  items.forEach((msg) => {
    const wrapper = document.createElement('div');
    wrapper.className = `chat-message ${msg.role || 'assistant'}`;
    const body = document.createElement('div');
    body.className = 'content';
    body.textContent = msg.content || '';
    wrapper.appendChild(body);
    if (prepend && chatBody.firstChild) {
      chatBody.insertBefore(wrapper, chatBody.firstChild);
    } else {
      chatBody.appendChild(wrapper);
    }
  });
  if (prepend) {
    chatBody.scrollTop += chatBody.scrollHeight - previousHeight;
  } else {
    chatBody.scrollTop = chatBody.scrollHeight;
  }
};

const loadChat = async (chatIdToLoad, { prepend = false, reset = false } = {}) => {
  if (!chatIdToLoad) return;
  const state = getChatState(chatIdToLoad);
  if (state.loading || state.done) return;
  if (reset) {
    state.offset = null;
    state.done = false;
  }
  state.loading = true;
  try {
    chatRequestCount += 1;
    const url = new URL(`${apiBaseUrl}/chat/${chatIdToLoad}`);
    url.searchParams.set('limit', DEFAULT_LIMIT);
    if (state.offset) {
      url.searchParams.set('offset', state.offset);
    }
    console.log('[chat_history] request', {
      id: chatRequestCount,
      url: url.toString(),
      chat_id: chatIdToLoad,
      offset: state.offset,
      limit: DEFAULT_LIMIT,
      prepend,
      reset,
    });
    const response = await fetch(url.toString());
    console.log('[chat_history] response', {
      id: chatRequestCount,
      status: response.status,
      ok: response.ok,
    });
    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    const messages = payload?.messages || [];
    console.log('[chat_history] payload', {
      id: chatRequestCount,
      count: messages.length,
      oldest_created_at: extractOldestCreatedAt(messages),
    });
    if (messages.length === 0 && state.offset) {
      state.done = true;
      return;
    }
    renderMessages(messages, prepend);
    const oldest = extractOldestCreatedAt(messages);
    if (oldest) {
      state.offset = oldest;
    }
  } catch (error) {
    console.error('[chat_history] error', error);
    appendMessage(
      'assistant',
      'Không thể tải lịch sử chat. Bạn vẫn có thể gửi tin nhắn mới.'
    );
  } finally {
    state.loading = false;
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
    console.log('[send_message] request', { endpoint, body });
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
    console.log('[send_message] response', {
      status: response.status,
      ok: response.ok,
      payload,
    });
    if (!chatId) {
      const newChatId = payload?.chat_id || chatId;
      if (newChatId) {
        setActiveChat(newChatId);
        getChatState(newChatId);
        chatHistoryDone = false;
        chatHistoryOffset = null;
        loadChatHistoryBase();
      }
    }
    const reply = payload?.content || 'Mình đã nhận được tin nhắn!';
    appendMessage('assistant', reply);
  } catch (error) {
    console.error('[send_message] error', error);
    appendMessage('assistant', error.message || 'Có lỗi khi gửi tin nhắn.');
  }
};

chatForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const content = messageInput.value.trim();
  if (!content) return;
  messageInput.value = '';
  messageInput.style.height = '48px';
  sendMessage(content);
});

messageInput.addEventListener('input', () => {
  messageInput.style.height = 'auto';
  messageInput.style.height = `${messageInput.scrollHeight}px`;
});

messageInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

newChatBtn.addEventListener('click', () => {
  chatBody.innerHTML = '';
  setActiveChat('');
  appendMessage('assistant', 'Cuộc hội thoại mới đã sẵn sàng.');
});

logoutLink.addEventListener('click', () => {
  localStorage.removeItem('chat_user');
  localStorage.removeItem('chat_id');
});

appendMessage('assistant', 'Xin chào! Hãy bắt đầu nhập câu hỏi của bạn.');
if (chatId) {
  loadChat(chatId, { reset: true });
}
loadChatHistoryBase();

chatListEl.addEventListener('scroll', () => {
  console.log('[chat_history_base] scroll', {
    scrollTop: chatListEl.scrollTop,
    scrollHeight: chatListEl.scrollHeight,
    clientHeight: chatListEl.clientHeight,
  });
  if (chatHistoryDone || chatHistoryLoading) return;
  const nearBottom =
    chatListEl.scrollTop + chatListEl.clientHeight >=
    chatListEl.scrollHeight - 12;
  if (nearBottom) {
    console.log('[chat_history_base] reached bottom, fetching next page');
    loadChatHistoryBase();
  }
});

chatBody.addEventListener('scroll', () => {
  console.log('[chat_history] scroll', {
    scrollTop: chatBody.scrollTop,
    scrollHeight: chatBody.scrollHeight,
    clientHeight: chatBody.clientHeight,
  });
  if (!chatId) return;
  if (chatBody.scrollTop <= 12) {
    console.log('[chat_history] reached top, fetching next page');
    loadChat(chatId, { prepend: true });
  }
});
