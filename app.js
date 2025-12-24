const tabs = document.querySelectorAll('.auth-tab');
const form = document.getElementById('auth-form');
const submitBtn = document.getElementById('submit-btn');
const alertBox = document.getElementById('alert');
let activeTab = 'login';

const apiBaseUrl = window.API_BASE_URL || '';


const setAlert = (message) => {
  if (!message) {
    alertBox.hidden = true;
    alertBox.textContent = '';
    return;
  }
  alertBox.hidden = false;
  alertBox.textContent = message;
};

const setActiveTab = (tab) => {
  activeTab = tab;
  tabs.forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tab);
  });
  submitBtn.textContent = tab === 'login' ? 'Đăng nhập' : 'Đăng ký';
  setAlert('');
};

tabs.forEach((button) => {
  button.addEventListener('click', () => setActiveTab(button.dataset.tab));
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setAlert('');
  const username = form.username.value.trim();
  const password = form.password.value.trim();

  if (!username || !password) {
    setAlert('Vui lòng nhập đầy đủ thông tin.');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Đang xử lý...';

  try {
    const response = await fetch(`${apiBaseUrl}/auth/${activeTab}`, {

      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      const message =
        errorPayload?.detail?.[0]?.msg ||
        'Không thể xử lý yêu cầu. Vui lòng thử lại.';
      throw new Error(message);
    }

    const user = await response.json();
    localStorage.setItem('chat_user', JSON.stringify(user));
    if (!localStorage.getItem('chat_id')) {
      localStorage.setItem('chat_id', crypto.randomUUID());
    }
    window.location.href = 'chat.html';
  } catch (error) {
    setAlert(error.message || 'Đã có lỗi xảy ra.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = activeTab === 'login' ? 'Đăng nhập' : 'Đăng ký';
  }
});
