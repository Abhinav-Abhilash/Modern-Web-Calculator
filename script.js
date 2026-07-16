document.addEventListener('DOMContentLoaded', () => {
    // --- State & DOM Elements ---
    const themeToggle = document.getElementById('themeToggle');
    const soundToggle = document.getElementById('soundToggle');
    const historyToggle = document.getElementById('historyToggle');
    const sciToggle = document.getElementById('sciToggle');
    const degRadToggle = document.getElementById('degRadToggle');
    const historyPanel = document.getElementById('historyPanel');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    const historyList = document.getElementById('historyList');
    const scientificKeypad = document.getElementById('scientificKeypad');
    
    const expressionDisplay = document.getElementById('expressionDisplay');
    const resultDisplay = document.getElementById('resultDisplay');
    const operatorIndicator = document.getElementById('operatorIndicator');
    const calcDisplay = document.querySelector('.calc-display');
    const toast = document.getElementById('toast');

    let isDark = true;
    let soundEnabled = true;
    let isSciMode = false;
    let isRadian = false;
    let history = JSON.parse(localStorage.getItem('calcHistory')) || [];

    // Calculator State
    let currentInput = '0';
    let expression = '';
    let shouldResetInput = false;
    let lastResult = null;

    // --- Audio Context for Synthetic Beeps ---
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    let audioCtx = new AudioContext();

    function playSound(type = 'click') {
        if (!soundEnabled) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        if (type === 'click') {
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.05);
            gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.05);
        } else if (type === 'action') {
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(300, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.1);
        }
    }

    // --- Theme & Toggles ---
    themeToggle.addEventListener('click', () => {
        isDark = !isDark;
        document.body.className = isDark ? 'dark-theme' : 'light-theme';
        themeToggle.innerHTML = isDark ? '<i data-lucide="sun"></i>' : '<i data-lucide="moon"></i>';
        lucide.createIcons();
        playSound('action');
    });

    soundToggle.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        soundToggle.classList.toggle('active', soundEnabled);
        soundToggle.innerHTML = soundEnabled ? '<i data-lucide="volume-2"></i>' : '<i data-lucide="volume-x"></i>';
        lucide.createIcons();
        playSound('action');
    });

    sciToggle.addEventListener('click', () => {
        isSciMode = !isSciMode;
        sciToggle.classList.toggle('active', isSciMode);
        scientificKeypad.classList.toggle('hidden', !isSciMode);
        playSound('action');
    });

    degRadToggle.addEventListener('click', () => {
        isRadian = !isRadian;
        degRadToggle.textContent = isRadian ? 'RAD' : 'DEG';
        playSound('action');
    });

    historyToggle.addEventListener('click', () => {
        historyPanel.classList.toggle('hidden');
        playSound('action');
    });

    // --- Calculator Logic ---

    function formatNumber(numStr) {
        if (numStr === 'Error' || numStr === 'NaN' || numStr === 'Infinity') return numStr;
        const parts = numStr.toString().split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return parts.join('.');
    }

    function updateDisplay() {
        resultDisplay.textContent = formatNumber(currentInput);
        expressionDisplay.textContent = expression;
    }

    function handleNumber(num) {
        if (shouldResetInput) {
            currentInput = num;
            shouldResetInput = false;
        } else {
            if (currentInput === '0' && num !== '.') {
                currentInput = num;
            } else {
                if (num === '.' && currentInput.includes('.')) return;
                currentInput += num;
            }
        }
        updateDisplay();
    }

    function handleOperator(opStr) {
        if (currentInput === 'Error') return;
        
        // If we just calculated a result, continue from it
        if (shouldResetInput && lastResult !== null) {
            expression = lastResult + ' ' + opStr + ' ';
            shouldResetInput = false;
        } else {
            // Append current input to expression
            expression += currentInput + ' ' + opStr + ' ';
        }
        
        currentInput = '0';
        shouldResetInput = true;
        updateDisplay();
    }

    function handleSciAction(action) {
        if (shouldResetInput && action !== 'open-paren') {
            shouldResetInput = false;
        }
        
        switch (action) {
            case 'sin':
            case 'cos':
            case 'tan':
            case 'log':
            case 'ln':
            case 'sqrt':
                const funcMap = {
                    'sin': 'sin(',
                    'cos': 'cos(',
                    'tan': 'tan(',
                    'log': 'log(',
                    'ln': 'ln(',
                    'sqrt': '√('
                };
                if (currentInput !== '0' && !shouldResetInput) {
                    expression += currentInput + ' * ' + funcMap[action];
                } else {
                    expression += funcMap[action];
                }
                currentInput = '0';
                break;
            case 'square':
                currentInput += '²';
                break;
            case 'power':
                expression += currentInput + ' ^ ';
                currentInput = '0';
                break;
            case 'pi':
                currentInput = Math.PI.toString();
                break;
            case 'e':
                currentInput = Math.E.toString();
                break;
            case 'factorial':
                currentInput += '!';
                break;
            case 'open-paren':
                expression += '( ';
                currentInput = '0';
                break;
            case 'close-paren':
                expression += currentInput + ' )';
                currentInput = '0';
                shouldResetInput = true;
                break;
        }
        shouldResetInput = true;
        updateDisplay();
    }

    function factorial(n) {
        if (n < 0) return NaN;
        if (n === 0 || n === 1) return 1;
        let res = 1;
        for (let i = 2; i <= n; i++) res *= i;
        return res;
    }

    function evaluateExpression(expr) {
        // Sanitize and replace
        let parsed = expr
            .replace(/×/g, '*')
            .replace(/÷/g, '/')
            .replace(/π/g, 'Math.PI')
            .replace(/e/g, 'Math.E')
            .replace(/log\(/g, 'Math.log10(')
            .replace(/ln\(/g, 'Math.log(')
            .replace(/√\(/g, 'Math.sqrt(')
            .replace(/\^/g, '**');

        // Handle trig functions with DEG/RAD
        const convert = isRadian ? '' : ' * Math.PI / 180';
        parsed = parsed.replace(/sin\(([^)]+)\)/g, `Math.sin(($1)${convert})`);
        parsed = parsed.replace(/cos\(([^)]+)\)/g, `Math.cos(($1)${convert})`);
        parsed = parsed.replace(/tan\(([^)]+)\)/g, `Math.tan(($1)${convert})`);
        
        // Handle unclosed functions like "sin(" by adding a closing paren before eval
        const openParens = (parsed.match(/\(/g) || []).length;
        const closeParens = (parsed.match(/\)/g) || []).length;
        for (let i = 0; i < openParens - closeParens; i++) {
            parsed += ')';
            expr += ')'; // update original visual expression too
        }

        // Handle square (²)
        parsed = parsed.replace(/([\d.]+)²/g, 'Math.pow($1, 2)');
        
        // Handle factorial (!)
        // Note: this simple regex handles numbers before !, not complex expressions like (5+3)!
        parsed = parsed.replace(/([\d.]+)!/g, (match, p1) => {
            return factorial(parseFloat(p1));
        });

        try {
            // Safe evaluation using Function
            let result = new Function('"use strict";return (' + parsed + ')')();
            
            // Handle divide by zero
            if (!isFinite(result) && !isNaN(result)) {
                return 'Error';
            }
            
            // Fix floating point precision issues (e.g. 0.1 + 0.2)
            if (typeof result === 'number') {
                result = parseFloat(result.toFixed(10));
            }
            
            return result.toString();
        } catch (e) {
            return 'Error';
        }
    }

    function calculateResult() {
        if (!expression && currentInput === '0') return;
        
        let fullExpression = expression + (shouldResetInput && currentInput === '0' ? '' : currentInput);
        let result = evaluateExpression(fullExpression);
        
        if (result !== 'Error') {
            addToHistory(fullExpression, result);
            lastResult = result;
        }
        
        currentInput = result;
        expression = fullExpression + ' =';
        shouldResetInput = true;
        updateDisplay();
    }

    function handleAction(action) {
        switch (action) {
            case 'clear':
                if (currentInput === '0' && expression === '') {
                    // Full AC
                    lastResult = null;
                }
                currentInput = '0';
                expression = '';
                shouldResetInput = false;
                document.getElementById('clearBtn').textContent = 'AC';
                break;
            case 'backspace':
                if (shouldResetInput || currentInput === 'Error') {
                    currentInput = '0';
                    shouldResetInput = false;
                } else {
                    currentInput = currentInput.slice(0, -1);
                    if (currentInput === '' || currentInput === '-') currentInput = '0';
                }
                break;
            case 'percent':
                if (currentInput !== '0' && currentInput !== 'Error') {
                    currentInput = (parseFloat(currentInput) / 100).toString();
                }
                break;
            case 'plus-minus':
                if (currentInput !== '0' && currentInput !== 'Error') {
                    if (currentInput.startsWith('-')) {
                        currentInput = currentInput.slice(1);
                    } else {
                        currentInput = '-' + currentInput;
                    }
                }
                break;
            case 'equals':
                calculateResult();
                break;
        }
        
        if (currentInput !== '0' || expression !== '') {
            document.getElementById('clearBtn').textContent = 'C';
        } else {
            document.getElementById('clearBtn').textContent = 'AC';
        }
        
        updateDisplay();
    }

    // --- History Management ---
    function renderHistory() {
        if (history.length === 0) {
            historyList.innerHTML = '<div class="history-empty">No history yet</div>';
            return;
        }
        
        historyList.innerHTML = '';
        history.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `
                <div class="history-expr">${item.expr}</div>
                <div class="history-res">${item.res}</div>
            `;
            div.addEventListener('click', () => {
                currentInput = item.res;
                expression = '';
                shouldResetInput = true;
                playSound('click');
                updateDisplay();
            });
            historyList.appendChild(div);
        });
    }

    function addToHistory(expr, res) {
        history.unshift({ expr, res });
        if (history.length > 20) history.pop(); // Keep last 20
        localStorage.setItem('calcHistory', JSON.stringify(history));
        renderHistory();
    }

    clearHistoryBtn.addEventListener('click', () => {
        history = [];
        localStorage.removeItem('calcHistory');
        renderHistory();
        playSound('action');
    });

    // --- Clipboard ---
    calcDisplay.addEventListener('click', () => {
        if (currentInput && currentInput !== 'Error') {
            navigator.clipboard.writeText(currentInput).then(() => {
                toast.classList.add('show');
                playSound('action');
                setTimeout(() => {
                    toast.classList.remove('show');
                }, 2000);
            });
        }
    });

    // --- Event Listeners for Buttons ---
    document.querySelectorAll('.btn').forEach(button => {
        button.addEventListener('click', () => {
            playSound('click');
            
            // Add a brief active class for visual feedback (since CSS :active can be short)
            button.classList.add('active');
            setTimeout(() => button.classList.remove('active'), 100);

            if (button.classList.contains('btn-number')) {
                handleNumber(button.dataset.number);
            } else if (button.classList.contains('btn-operator')) {
                const opMap = { 'add': '+', 'subtract': '-', 'multiply': '×', 'divide': '÷' };
                handleOperator(opMap[button.dataset.action]);
            } else if (button.classList.contains('btn-action') || button.classList.contains('btn-equals')) {
                handleAction(button.dataset.action);
            } else if (button.classList.contains('btn-sci')) {
                if (button.dataset.action !== 'deg-rad') {
                    handleSciAction(button.dataset.action);
                }
            }
        });
    });

    // --- Keyboard Support ---
    document.addEventListener('keydown', (e) => {
        // Prevent default behavior for Enter and Backspace to avoid unintended page actions
        if (e.key === 'Enter') e.preventDefault();
        
        let keyProcessed = false;

        if (/[0-9.]/.test(e.key)) {
            handleNumber(e.key);
            keyProcessed = true;
        } else if (e.key === '+' || e.key === '-') {
            handleOperator(e.key);
            keyProcessed = true;
        } else if (e.key === '*' || e.key === 'x') {
            handleOperator('×');
            keyProcessed = true;
        } else if (e.key === '/') {
            handleOperator('÷');
            keyProcessed = true;
            e.preventDefault();
        } else if (e.key === 'Enter' || e.key === '=') {
            handleAction('equals');
            keyProcessed = true;
        } else if (e.key === 'Backspace') {
            handleAction('backspace');
            keyProcessed = true;
        } else if (e.key === 'Escape') {
            handleAction('clear');
            keyProcessed = true;
        } else if (e.key === '%') {
            handleAction('percent');
            keyProcessed = true;
        } else if (e.key === '(') {
            if (isSciMode) handleSciAction('open-paren');
            keyProcessed = true;
        } else if (e.key === ')') {
            if (isSciMode) handleSciAction('close-paren');
            keyProcessed = true;
        }

        if (keyProcessed) {
            playSound('click');
        }
    });

    // Init
    renderHistory();
    lucide.createIcons();
});
