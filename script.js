let recognition;
        let isListening = false;
        let keywordsContent = '';
        let mainContextContent = '';
        let conversationHistory = [];
        let isKeywordsActive = false;
        let isContextActive = false;
        let debounceTimer;

        document.addEventListener('DOMContentLoaded', function() {
            AOS.init({ duration: 800, easing: 'ease-in-out', once: true });
            feather.replace();
            setupEventListeners();
            loadSettings();
            loadConversationFromLocalStorage(); // Load conversation history and frame content
            setupSpeechRecognition();
        });

        function setupEventListeners() {
            document.getElementById('settingsBtn').addEventListener('click', openSettings);
            document.getElementById('closeModal').addEventListener('click', closeSettings);
            document.getElementById('cancelSettings').addEventListener('click', closeSettings);
            document.getElementById('saveSettings').addEventListener('click', saveSettings);
            document.getElementById('powerToggle').addEventListener('change', toggleListening);
            document.getElementById('fontSize').addEventListener('change', changeFontSize);
            
            setupFileInput('keywords');
            setupFileInput('context');

            document.getElementById('activateKeywords').addEventListener('click', toggleContextActivation);
            document.getElementById('activateContext').addEventListener('click', toggleContextActivation);
            document.getElementById('voiceToggle').addEventListener('change', toggleVoice);
            document.getElementById('clearButton').addEventListener('click', clearOutputFrames);

            document.getElementById('textOutput1').addEventListener('click', handleIconClick);
            document.getElementById('textOutput2').addEventListener('click', handleIconClick);

            //             // window.addEventListener('beforeunload', saveConversationOnUnload);
        }

        function handleIconClick(event) {
            const target = event.target;
            const voiceIconContainer = target.closest('.voice-icon');
            const deleteIconContainer = target.closest('.delete-icon-style');

            if (voiceIconContainer) {
                const text = voiceIconContainer.getAttribute('data-text');
                const lang = voiceIconContainer.getAttribute('data-lang');
                textToVoice(text, { lang: lang }, voiceIconContainer);
            } else if (deleteIconContainer) {
                const conversationId = deleteIconContainer.getAttribute('data-conversation-id');
                if (conversationId) {
                    deleteConversationEntry(conversationId);
                }
            }
        }

        function deleteConversationEntry(conversationId) {
            // Remove from DOM
            const elementsToDelete = document.querySelectorAll(`[data-conversation-id="${conversationId}"]`);
            elementsToDelete.forEach(el => el.remove());

            // Remove from conversationHistory
            conversationHistory = conversationHistory.filter(entry => entry.conversationId !== conversationId);
            localStorage.setItem('conversation_history', JSON.stringify(conversationHistory));

            // Update localStorage for textOutput1 and textOutput2
            localStorage.setItem('textOutput1_content', document.getElementById('textOutput1').innerHTML);
            localStorage.setItem('textOutput2_content', document.getElementById('textOutput2').innerHTML);

            showMessage('Mensaje eliminado.', 'success');
        }

        function clearOutputFrames() {
            document.getElementById('textOutput1').innerHTML = '';
            document.getElementById('textOutput2').innerHTML = '';
            conversationHistory = []; // Clear conversation history as well
            localStorage.removeItem('textOutput1_content');
            localStorage.removeItem('textOutput2_content');
            localStorage.removeItem('conversation_history');
            showMessage('Contenido limpiado.', 'success');
        }

        function toggleVoice() {
            const isActive = document.getElementById('voiceToggle').checked;
            if (isActive) {
                document.body.classList.add('voice-active');
            } else {
                document.body.classList.remove('voice-active');
            }
        }

        function toggleAllowDelete() {
            const isActive = document.getElementById('allowDeleteToggle').checked;
            if (isActive) {
                document.body.classList.add('allow-delete-active');
            } else {
                document.body.classList.remove('allow-delete-active');
            }
        }

        function setupFileInput(type) {
            const fileInput = document.getElementById(`${type}File`);
            const btn = document.getElementById(`${type}Btn`);
            const clearBtn = document.getElementById(`${type}ClearBtn`);

            btn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', e => readFileContent(e.target.files[0], type));
            clearBtn.addEventListener('click', () => clearFileContent(type));
        }

        function clearFileContent(type) {
            if (type === 'keywords') {
                keywordsContent = '';
                document.getElementById('keywordsFile').value = ''; // Reset file input
            } else if (type === 'context') {
                mainContextContent = '';
                document.getElementById('contextFile').value = ''; // Reset file input
            }
            updateFileIndicator(type, '');
        }

        function updateFileIndicator(type, fileName) {
            const btnId = type === 'keywords' ? 'keywordsBtn' : 'contextBtn';
            const nameId = type === 'keywords' ? 'keywordsName' : 'contextName';
            const clearBtnId = type === 'keywords' ? 'keywordsClearBtn' : 'contextClearBtn';
            
            const btnEl = document.getElementById(btnId);
            const nameEl = document.getElementById(nameId);
            const clearBtnEl = document.getElementById(clearBtnId);

            if (fileName && fileName !== 'Ningún archivo seleccionado') {
                nameEl.textContent = fileName;
                btnEl.textContent = 'Cambiar archivo';
                btnEl.classList.remove('bg-gray-100', 'text-gray-700', 'hover:bg-gray-200');
                btnEl.classList.add('bg-green-100', 'text-green-700', 'hover:bg-green-200');
                clearBtnEl.classList.remove('hidden');
            } else {
                nameEl.textContent = 'Ningún archivo seleccionado';
                btnEl.textContent = 'Seleccionar archivo';
                btnEl.classList.remove('bg-green-100', 'text-green-700', 'hover:bg-green-200');
                btnEl.classList.add('bg-gray-100', 'text-gray-700', 'hover:bg-gray-200');
                clearBtnEl.classList.add('hidden');
            }
        }

        function readFileContent(file, type) {
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                if (type === 'keywords') {
                    keywordsContent = e.target.result;
                    updateFileIndicator('keywords', file.name);
                    showMessage('Archivo de palabras clave cargado.', 'success');
                } else if (type === 'context') {
                    mainContextContent = e.target.result;
                    updateFileIndicator('context', file.name);
                    showMessage('Archivo de contexto principal cargado.', 'success');
                }
            };
            reader.onerror = () => showMessage('Error al leer el archivo.', 'error');
            if (file.name.endsWith('.docx')) {
                showMessage('Atención: La lectura de archivos .docx es experimental y puede no mostrar el contenido correctamente. Se recomienda usar .txt.', 'warning', 7000);
            }
            reader.readAsText(file);
        }

        function toggleContextActivation(event) {
            const btn = event.target;
            const isActive = btn.classList.toggle('bg-indigo-500');
            btn.classList.toggle('text-white');

            if (btn.id === 'activateKeywords') {
                isKeywordsActive = isActive;
                btn.textContent = isActive ? 'Palabras Clave Activadas' : 'Activar Palabras Clave';
            } else if (btn.id === 'activateContext') {
                isContextActive = isActive;
                btn.textContent = isActive ? 'Contexto Activado' : 'Activar Contexto';
            }
        }

        function setupSpeechRecognition() {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                showMessage('El reconocimiento de voz no es compatible con este navegador.', 'error');
                return;
            }
            recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.manualStop = false;

            recognition.onstart = () => { isListening = true; updateStatusIndicator(true); };
            
            recognition.onend = () => {
                if (isListening) { // If it stopped but we still want it to be listening
                    recognition.start(); // Restart recognition
                } else {
                    updateStatusIndicator(false);
                }
            };

            recognition.onerror = (event) => console.error('Error en el reconocimiento de voz:', event.error);

            recognition.onresult = (event) => {
                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript;
                    } else {
                        interimTranscript += transcript;
                    }
                }

                let interimEl = document.getElementById('interim-span');
                if (!interimEl) {
                    interimEl = document.createElement('p');
                    interimEl.id = 'interim-span';
                    interimEl.className = 'text-gray-500';
                    document.getElementById('textOutput1').appendChild(interimEl);
                }
                interimEl.textContent = interimTranscript;

                if (finalTranscript) {
                    if(interimEl) interimEl.remove();
                    const currentConversationId = appendToOutput('textOutput1', finalTranscript.trim(), null); // Get the ID
                    translateText(finalTranscript.trim(), currentConversationId); // Pass the ID
                }
                autoScroll();
            };
        }

        function toggleListening() {
            const isActive = document.getElementById('powerToggle').checked;
            if (isActive) {
                startListening(false);
            } else {
                stopListening();
                // if (document.getElementById('saveConversationToggle').checked) {
                //     downloadConversation();
                // }
            }
        }

        function startListening(clearOutput = true) {
            if (!recognition) return;
            isListening = true;
            recognition.manualStop = false;
            const lang1 = document.getElementById('language1').value;
            recognition.lang = lang1;
            if (clearOutput) {
                conversationHistory = [];
                document.getElementById('textOutput1').innerHTML = '';
                document.getElementById('textOutput2').innerHTML = '';
            }
            try {
                recognition.start();
            } catch(e) { console.error("Error al iniciar el reconocimiento:", e); }
        }

        function stopListening() {
            if (!recognition || !isListening) return;
            isListening = false; // Explicitly set to false
            recognition.manualStop = true;
            recognition.stop();
        }

        async function callGeminiAPI(prompt) {
            const apiKey = document.getElementById('apiKey').value;
            const model = document.getElementById('model').value;
            if (!apiKey) {
                throw new Error('API Key de Gemini no configurada.');
            }
            const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

            let lastError = null;
            for (let i = 0; i < 3; i++) {
                try {
                    const response = await fetch(API_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        return data.candidates[0].content.parts[0].text;
                    }

                    if (response.status === 503) {
                        lastError = new Error(`Error en la solicitud a la API: ${response.status} (El modelo está sobrecargado)`);
                        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
                        continue;
                    }

                    const errorBody = await response.text();
                    throw new Error(`Error en la solicitud a la API: ${response.status} ${errorBody}`);

                } catch (error) {
                    lastError = error;
                    console.error(`Intento ${i+1} fallido:`, error);
                }
            }
            throw lastError; // Throw the last error after all retries fail
        }

        async function translateText(text, conversationId = null) { // Accept conversationId
            const lang1 = document.getElementById('language1').value;
            const lang2 = document.getElementById('language2').value;
            const lang2Name = document.getElementById('language2').options[document.getElementById('language2').selectedIndex].text;
            const autoResponse = document.getElementById('autoResponseToggle').checked;

            addToHistory('ORIGINAL', text, conversationId);

            if (autoResponse) {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    generateAIResponse(text, conversationId);
                }, 1000); // Espera 1 segundo de inactividad
                return;
            }

            if (lang1 === lang2) {
                const message = `El texto ya está en ${lang2Name}.`;
                appendToOutput('textOutput2', message, 'INFO', conversationId);
                addToHistory('INFO', message, conversationId);
                return;
            }

            // This part is only reached if autoResponse is false and lang1 !== lang2
            const prompt = `Translate the following text to ${lang2Name}. Provide only the translated text, without any additional explanations, comments, or alternatives: "${text}"`;
            try {
                const translatedText = await callGeminiAPI(prompt);
                appendToOutput('textOutput2', translatedText, 'T', conversationId);
                addToHistory('T', translatedText, conversationId);
            } catch (error) {
                console.error('Error en la traducción:', error);
                appendToOutput('textOutput2', error.message, 'ERROR', conversationId);
            }
        }

        async function generateAIResponse(originalText, conversationId = null) { // Accept conversationId
            const lang2Name = document.getElementById('language2').options[document.getElementById('language2').selectedIndex].text;
            let prompt = `You are a helpful assistant. The user just heard the following text: "${originalText}". Your task is to generate a response in ${lang2Name} acting as the user.`;

            if (isContextActive && mainContextContent) {
                prompt += `

Use the following main context to formulate your response:
${mainContextContent}`;
            }
            if (isKeywordsActive && keywordsContent) {
                prompt += `

Also, consider these keywords:
${keywordsContent}`;
            }

            try {
                const aiResponse = await callGeminiAPI(prompt);
                appendToOutput('textOutput2', aiResponse, 'IA', conversationId); // Pass conversationId
                addToHistory('IA', aiResponse, conversationId); // Pass conversationId
            } catch (error) {
                console.error('Error en la respuesta de IA:', error);
                appendToOutput('textOutput2', error.message, 'ERROR', conversationId);
            }
        }

        function createVoiceIconElement(text, lang) {
            const voiceIconContainer = document.createElement('span');
            voiceIconContainer.className = 'voice-icon';
            const voiceIcon = document.createElement('i');
            voiceIcon.setAttribute('data-feather', 'volume-2');
            voiceIconContainer.appendChild(voiceIcon);

            voiceIconContainer.setAttribute('data-text', text);
            voiceIconContainer.setAttribute('data-lang', lang);

            return voiceIconContainer;
        }

        function createDeleteIconElement(conversationId) { // Accept conversationId
            const deleteIconContainer = document.createElement('span');
            deleteIconContainer.className = 'delete-icon-style'; // Use new class for styling
            const deleteIcon = document.createElement('i');
            deleteIcon.setAttribute('data-feather', 'trash-2'); // Using trash-2 icon from feather icons
            deleteIconContainer.appendChild(deleteIcon);

            // Store conversationId in data attribute for event delegation
            deleteIconContainer.setAttribute('data-conversation-id', conversationId);

            return deleteIconContainer;
        }

        let conversationCounter = 0; // Initialize a counter for conversation entries

        function appendToOutput(elementId, text, label, conversationId = null) {
            const outputDiv = document.getElementById(elementId);
            const p = document.createElement('p');
            p.className = 'mb-2 flex justify-between items-center'; // Use flexbox

            // Generate a new conversationId if not provided (for the first entry of a pair)
            if (conversationId === null) {
                conversationCounter++;
                conversationId = `conv-${conversationCounter}`;
            }
            p.setAttribute('data-conversation-id', conversationId); // Assign unique ID to the paragraph

            const textContainer = document.createElement('span');
            if (label) {
                const strong = document.createElement('strong');
                strong.textContent = `${label}: `;
                textContainer.appendChild(strong);
            }
            const textNode = document.createTextNode(text);
            textContainer.appendChild(textNode);

            const lang = elementId === 'textOutput1' ? document.getElementById('language1').value : document.getElementById('language2').value;
            const voiceIconElement = createVoiceIconElement(text, lang);

            p.appendChild(textContainer);

            const iconsContainer = document.createElement('span'); // New container for icons
            iconsContainer.className = 'flex items-center'; // To align icons

            iconsContainer.appendChild(voiceIconElement);

            // Add delete icon if allowed
            if (document.getElementById('allowDeleteToggle').checked) {
                const deleteIconElement = createDeleteIconElement(conversationId); // Pass conversationId
                iconsContainer.appendChild(deleteIconElement);
            }
            
            p.appendChild(iconsContainer); // Append the icons container to the paragraph

            outputDiv.appendChild(p);
            feather.replace();
            autoScroll();

            // Save content to localStorage after each append
            localStorage.setItem('textOutput1_content', document.getElementById('textOutput1').innerHTML);
            localStorage.setItem('textOutput2_content', document.getElementById('textOutput2').innerHTML);

            return conversationId; // Return the conversationId for the paired entry
        }

        // Translate text to voice
        function textToVoice(text, options = {}, iconElement) {
            if (speechSynthesis.speaking) {
                speechSynthesis.cancel();
                const playingIcons = document.querySelectorAll('.voice-playing');
                playingIcons.forEach(icon => icon.classList.remove('voice-playing'));
                return;
            }

            const wasListening = isListening;
            if (wasListening) {
                stopListening();
            }

            const utterance = new SpeechSynthesisUtterance(text);
            const defaultOptions = {
                lang: 'es-ES', rate: 0.8, pitch: 1, volume: 1, voice: null,
            };
            const combinedOptions = { ...defaultOptions, ...options };

            utterance.lang = combinedOptions.lang;
            utterance.rate = combinedOptions.rate;
            utterance.pitch = combinedOptions.pitch;
            utterance.volume = combinedOptions.volume;
            if (combinedOptions.voice) utterance.voice = combinedOptions.voice;

            utterance.onstart = () => {
                if (iconElement) iconElement.classList.add('voice-playing');
            };

            utterance.onend = () => {
                if (iconElement) iconElement.classList.remove('voice-playing');
                if (wasListening && document.getElementById('powerToggle').checked) {
                    startListening(false);
                }
            };

            utterance.onerror = () => {
                if (iconElement) iconElement.classList.remove('voice-playing');
                console.error("Error en la síntesis de voz.");
                if (wasListening && document.getElementById('powerToggle').checked) {
                    startListening(false);
                }
            };

            speechSynthesis.speak(utterance);
        }

        function generateConversationFileContent() {
            const date = new Date();
            let fileContent = `Conversación del ${date.toLocaleString()}

`;
            conversationHistory.forEach(entry => {
                fileContent += `[${entry.timestamp}] ${entry.type}: ${entry.text}
`;
            });
            return { filename: `dialogo_${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}_${date.getHours()}-${date.getMinutes()}.txt`, content: fileContent };
        }

        

        

        function addToHistory(type, text, conversationId = null) { // Accept conversationId
            if (document.getElementById('saveConversationToggle').checked) {
                const timestamp = new Date().toLocaleTimeString();
                conversationHistory.push({ timestamp, type, text, conversationId }); // Store conversationId
                localStorage.setItem('conversation_history', JSON.stringify(conversationHistory)); // Save to localStorage
            }
        }

        function downloadConversation() {
            if (conversationHistory.length === 0) return;
            showMessage('Conversación guardada localmente.', 'success');
            // conversationHistory is already saved to localStorage continuously
            // No need to clear it here, as it's meant to persist across sessions
        }

        

        function autoScroll() {
            document.getElementById('textOutput1').scrollTop = document.getElementById('textOutput1').scrollHeight;
            document.getElementById('textOutput2').scrollTop = document.getElementById('textOutput2').scrollHeight;
        }

        function updateStatusIndicator(isActive) {
            const statusIndicator = document.getElementById('statusIndicator');
            const span = statusIndicator.querySelector('span');
            const dot = statusIndicator.querySelector('div');
            statusIndicator.classList.remove('hidden');
            if (isActive) {
                span.textContent = 'Modo Escucha: Activo';
                dot.classList.replace('bg-red-500', 'bg-green-500');
            } else {
                span.textContent = 'Modo Escucha: Inactivo';
                dot.classList.replace('bg-green-500', 'bg-red-500');
            }
        }

        let messageStripTimeout;

        function showMessage(message, type = 'info', duration = 3000) {
            const messageStrip = document.getElementById('messageStrip');
            
            // Clear previous classes and timeout
            // Reset all classes to base state, including inline styles
            messageStrip.className = 'p-0 text-sm font-medium transition-all duration-500 ease-out opacity-0 z-50 flex items-center rounded-lg shadow-md';
            messageStrip.style.maxWidth = '0';
            messageStrip.style.padding = '0';
            messageStrip.style.opacity = '0';
            messageStrip.style.whiteSpace = 'nowrap'; // Ensure nowrap is applied
            messageStrip.style.overflow = 'hidden'; // Ensure overflow hidden is applied

            clearTimeout(messageStripTimeout);

            // Set message text and type class
            messageStrip.innerHTML = `
                <p id="messageText" class="flex items-center">
                    <span class="message-prefix">Mensaje:</span>
                    <span>${message}</span>
                </p>
            `;
            
            // Apply type-specific background and text color
            messageStrip.classList.add(`message-${type}`);
            
            // Trigger animation
            // Use a small delay to ensure the initial state is rendered before applying 'show' to allow CSS to register initial state
            setTimeout(() => {
                messageStrip.style.maxWidth = '80%'; // Expand to 80% of parent width
                messageStrip.style.padding = '12px 16px'; // Add padding
                messageStrip.style.opacity = '1';
            }, 50);


            // Hide after duration
            messageStripTimeout = setTimeout(() => {
                messageStrip.style.maxWidth = '0'; // Collapse
                messageStrip.style.padding = '0'; // Remove padding
                messageStrip.style.opacity = '0';
            }, duration);
        }

        

        async function openSettings() {
            document.getElementById('settingsModal').classList.replace('modal-closed', 'modal-open');
        }
        function closeSettings() { document.getElementById('settingsModal').classList.replace('modal-open', 'modal-closed'); }

        function saveSettings() {
            const settings = {
                apiKey: document.getElementById('apiKey').value,
                model: document.getElementById('model').value,
                email: document.getElementById('email').value,
                password: document.getElementById('password').value,
                keywordsFile: {
                    name: document.getElementById('keywordsName').textContent,
                    content: keywordsContent
                },
                contextFile: {
                    name: document.getElementById('contextName').textContent,
                    content: mainContextContent
                },
                voiceEnabled: document.getElementById('voiceToggle').checked,
                allowDeleteEnabled: document.getElementById('allowDeleteToggle').checked,
                saveConversationEnabled: document.getElementById('saveConversationToggle').checked
            };
            localStorage.setItem('asesonet_settings', JSON.stringify(settings));
            // Save current frame content to localStorage
            localStorage.setItem('textOutput1_content', document.getElementById('textOutput1').innerHTML);
            localStorage.setItem('textOutput2_content', document.getElementById('textOutput2').innerHTML);
            localStorage.setItem('conversation_history', JSON.stringify(conversationHistory));

            showMessage('Configuración guardada correctamente', 'success');
            closeSettings();
        }

        function loadSettings() {
            const savedSettings = localStorage.getItem('asesonet_settings');
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                document.getElementById('apiKey').value = settings.apiKey || '';
                document.getElementById('model').value = settings.model || 'gemini-pro-latest';
                document.getElementById('email').value = settings.email || '';
                document.getElementById('password').value = settings.password || '';

                if (settings.keywordsFile && settings.keywordsFile.content) {
                    keywordsContent = settings.keywordsFile.content;
                    updateFileIndicator('keywords', settings.keywordsFile.name);
                }
                if (settings.contextFile && settings.contextFile.content) {
                    mainContextContent = settings.contextFile.content;
                    updateFileIndicator('context', settings.contextFile.name);
                    if (mainContextContent) {
                        document.getElementById('activateContext').click();
                    }
                }
                if (settings.voiceEnabled) {
                    document.getElementById('voiceToggle').checked = true;
                    toggleVoice();
                }
                if (settings.allowDeleteEnabled) {
                    document.getElementById('allowDeleteToggle').checked = true;
                    toggleAllowDelete();
                }
                // Set Save Conversation toggle based on saved settings or default to true
                document.getElementById('saveConversationToggle').checked = settings.saveConversationEnabled !== undefined ? settings.saveConversationEnabled : true;
            }
            loadConversationFromLocalStorage(); // Load conversation after settings
        }

        function loadConversationFromLocalStorage() {
            const savedTextOutput1 = localStorage.getItem('textOutput1_content');
            const savedTextOutput2 = localStorage.getItem('textOutput2_content');
            const savedConversationHistory = localStorage.getItem('conversation_history');

            if (savedTextOutput1) {
                document.getElementById('textOutput1').innerHTML = savedTextOutput1;
            }
            if (savedTextOutput2) {
                document.getElementById('textOutput2').innerHTML = savedTextOutput2;
            }
            if (savedConversationHistory) {
                conversationHistory = JSON.parse(savedConversationHistory);
                // Re-render feather icons for loaded content
                feather.replace();

                // Find the maximum conversationId from the loaded history and update conversationCounter
                let maxId = 0;
                conversationHistory.forEach(entry => {
                    if (entry.conversationId) {
                        const idNum = parseInt(entry.conversationId.replace('conv-', ''));
                        if (!isNaN(idNum) && idNum > maxId) {
                            maxId = idNum;
                        }
                    }
                });
                conversationCounter = maxId;
            }
        }

        function changeFontSize() {
            const size = document.getElementById('fontSize').value + 'px';
            document.getElementById('textOutput1').style.fontSize = size;
            document.getElementById('textOutput2').style.fontSize = size;
        }