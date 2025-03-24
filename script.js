let apiKey = localStorage.getItem('openai-api-key');
let currentImage = null;
let contextText = "";

document.getElementById('uploadButton').addEventListener('click', () => {
    document.getElementById('fileInput').click();
});

document.getElementById('fileInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    const previewContainer = document.getElementById('previewBox');
    
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert('Пожалуйста, выберите изображение');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        alert('Файл слишком большой! Максимальный размер 5MB');
        return;
    }

    // Очистка предыдущих данных
    currentImage = null;
    contextText = "";

    // Превью изображения
    const reader = new FileReader();
    reader.onload = async (e) => {
        previewContainer.innerHTML = `
            <h3>Предпросмотр:</h3>
            <img class="preview-image" src="${e.target.result}" alt="Preview">
        `;

        // Распознавание текста
        try {
            const worker = await Tesseract.createWorker('rus');
            const { data: { text } } = await worker.recognize(file);
            contextText = text;
            await worker.terminate();
            
            previewContainer.innerHTML += `
                <h3>Распознанный текст:</h3>
                <div class="recognized-text">${text}</div>
            `;
        } catch (error) {
            console.error('OCR Error:', error);
            alert('Ошибка распознавания текста');
        }
    };
    reader.readAsDataURL(file);
});

document.getElementById('saveApiKey').addEventListener('click', () => {
    apiKey = document.getElementById('apiKeyInput').value;
    localStorage.setItem('openai-api-key', apiKey);
    document.getElementById('apiKeyModal').style.display = 'none';
});

document.getElementById('sendButton').addEventListener('click', async () => {
    if (!apiKey) {
        alert('Пожалуйста, введите API ключ');
        document.getElementById('apiKeyModal').style.display = 'block';
        return;
    }

    const userInput = document.getElementById('userInput');
    const question = userInput.value.trim();
    if (!question) return;

    const chatMessages = document.getElementById('chatMessages');
    
    // Добавление сообщения пользователя
    const userMessage = document.createElement('div');
    userMessage.className = 'message user-message';
    userMessage.innerHTML = `<p>${question}</p>`;
    chatMessages.appendChild(userMessage);

    // Индикатор загрузки
    const loadingMessage = document.createElement('div');
    loadingMessage.className = 'message bot-message';
    loadingMessage.innerHTML = '<p>Анализирую данные...</p>';
    chatMessages.appendChild(loadingMessage);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    userInput.value = '';

    try {
        let answer;
        if (contextText) {
            answer = await analyzeWithText(question);
        } else {
            answer = await analyzeWithImage(question);
        }

        loadingMessage.remove();
        const botMessage = document.createElement('div');
        botMessage.className = 'message bot-message';
        botMessage.innerHTML = `<p>${answer}</p>`;
        chatMessages.appendChild(botMessage);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    } catch (error) {
        loadingMessage.innerHTML = '<p>Ошибка при обработке запроса</p>';
    }
});

async function analyzeWithImage(question) {
    const messages = [{
        role: "user",
        content: [
            { type: "text", text: question },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${currentImage}` } }
        ]
    }];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "gpt-4-vision-preview",
            max_tokens: 1000,
            messages: messages
        })
    });

    const data = await response.json();
    return data.choices[0].message.content;
}

async function analyzeWithText(question) {
    const systemPrompt = `Ты эксперт по анализу отчетов. Отвечай строго на основе предоставленного контекста: 
${contextText}

Если вопрос не связан с контекстом, вежливо сообщи об этом.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "gpt-4",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: question }
            ]
        })
    });

    const data = await response.json();
    return data.choices[0].message.content;
}

// Инициализация при загрузке
if (!apiKey) {
    document.getElementById('apiKeyModal').style.display = 'block';
}