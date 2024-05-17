const maxQuestions = 15;
let questionHistory = [];
let currentSession = null;
let selectedOption;
let currentQuestion;  // Global variable to hold the current question
let allQuestions = [];
let timer;

/* IndexedDB Setup */
let db;
let dbReady = new Promise((resolve, reject) => {
    const request = indexedDB.open("TestDatabase", 1);

    request.onupgradeneeded = function(event) {
        let db = event.target.result;
        db.createObjectStore("evaluations", { keyPath: "id", autoIncrement: true });
        db.createObjectStore("currentSession", { keyPath: "id" });
    };

    request.onsuccess = function(event) {
        db = event.target.result;
        resolve();
    };

    request.onerror = function(event) {
        console.error('Database error: ' + event.target.errorCode);
        reject('Database error: ' + event.target.errorCode);
    };
});

/* Temporizador */
function TimeCounter(timerElement) {
    this.seconds = 0;
    this.minutes = 0;
    this.hours = 0;
    this.timer = timerElement;
    this.interval = null;

    // Método para iniciar el contador
    this.start = function() {
        if (this.interval) return;  // Evitar iniciar múltiples intervalos
        this.interval = setInterval(() => {
            this.seconds++;
            if (this.seconds === 60) {
                this.minutes++;
                this.seconds = 0;
            }
            if (this.minutes === 60) {
                this.hours++;
                this.minutes = 0;
            }
            this.print();
        }, 1000);
    };

    this.print = function(){
        this.timer.textContent = this.pad(this.hours) + ':' + this.pad(this.minutes) + ':' + this.pad(this.seconds);
    }

    // Método para detener el contador
    this.stop = function() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    };

    // Método para resetear el contador
    this.reset = function() {
        this.stop();  // Detener cualquier intervalo que esté corriendo
        this.seconds = 0;
        this.minutes = 0;
        this.hours = 0;
        this.timer.textContent = this.pad(this.hours) + ':' + this.pad(this.minutes) + ':' + this.pad(this.seconds);
    };

    // Método auxiliar para formatear el tiempo
    this.pad = function(val) {
        return val < 10 ? '0' + val : val;
    };
}

function saveCurrentSession(question) {
    return new Promise((resolve, reject) => {
        const sessionData = {
            id: 1,  // Asumimos una única sesión activa posible a la vez
            hours : timer.hours,
            minutes : timer.minutes,
            seconds : timer.seconds,
            index : currentSession ? currentSession.index : 0,
            questionId: question.id,
            selectedOption: question.selectedOption,
            history: questionHistory
        };
        const transaction = db.transaction(["currentSession"], "readwrite");
        const store = transaction.objectStore("currentSession");
        const request = store.put(sessionData);
        request.onsuccess = () => {
            resolve();
        };
        request.onerror = () => {
            reject(request.error);
        };
    });
}

function clearCurrentSession() {
    const transaction = db.transaction(["currentSession"], "readwrite");
    const store = transaction.objectStore("currentSession");
    store.clear();
    index = 0;
    questionHistory = [];
}

async function getCurrentSession() {
    await dbReady;  // Asegúrate de que la base de datos esté lista

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["currentSession"], "readonly");
        const store = transaction.objectStore("currentSession");
        const request = store.get(1);
        request.onsuccess = () => {
            resolve(request.result);
        };
        request.onerror = () => {
            reject(request.error);
        };
    });
}

/* Control de la evaluación */
async function startTest() {
    clearCurrentSession();
    await loadQuestion();
}

async function endTest() {
    currentSession.index = 0;
    updateProgress();
    clearCurrentSession();
    switchButtons();
    window.location.href = "index.html";
}

async function fetchQuestionFile(filename) {
    try {
        const response = await fetch(`assets/json/${filename}`);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    } catch (error) {
        console.error('Error fetching data: ', error);
    }
}

function getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}

async function loadAllQuestions() {
    const files = ["questions1.json", "questions2.json"]; // Corregido para incluir tres archivos diferentes
    for (let file of files) {
        let questions = await fetchQuestionFile(file);
        allQuestions.push(...questions);
    }
}

async function createNewTest() {
    //Crear un nuevo examen:
    await loadAllQuestions();  // Carga todas las preguntas de los archivos JSON
    selectRandomQuestions();   // Selecciona una cantidad de preguntas aleatoriamente
    shuffleOptionsInHistory(); // Mezcla las opciones de cada pregunta en la historia
    console.table(questionHistory);
    await saveCurrentSession(questionHistory[0], null);
}

async function loadQuestion() {

    if(currentSession && currentSession.index + 1 > maxQuestions){
        //Mostrar resultados del test
        gradeExam();
        return;
    }

    if (!currentSession) {
        await createNewTest();
        currentSession = await getCurrentSession();
    } 

    questionHistory = currentSession.history;
    currentQuestion = questionHistory[currentSession.index];

    if (currentQuestion) {
        updateProgress();
        displayQuestion(currentQuestion);
        //switchPageButtons();
        switchButtons()
    }
}

function selectRandomQuestions() {
    let shuffledQuestions = [...allQuestions];
    shuffleArray(shuffledQuestions); // Mezcla el array para aleatoriedad
    questionHistory = shuffledQuestions.slice(0, maxQuestions);
}

function shuffleOptionsInHistory() {
    questionHistory.forEach(question => {
        if (question.options && question.options.length > 1) {
            shuffleArray(question.options);
        }
    });
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1)); // número aleatorio entre 0 e i
        [array[i], array[j]] = [array[j], array[i]]; // intercambio de elementos
    }
}

function displayQuestion(question) {
    const questionDiv = document.getElementById('questionDisplay');
    questionDiv.innerHTML = `<div class="question"><p>${question.id}) ${question.ask}</p></div>`;
    
    if(question.expression) {
        questionDiv.innerHTML += `<div class="center"><p>${question.expression}</p></div>`;
    } else if (question.img) {
        questionDiv.innerHTML += `<div class="center"><img src="${question.img}" /></div>`;
    }
    
    // Mezclar las opciones antes de mostrarlas
    shuffleArray(question.options);
    let disabled = typeof question.selectedOption === 'string' && question.selectedOption.length > 0 ? "disabled" : "";
    
    question.options.forEach((option, index) => {
        let checked = question.selectedOption && question.selectedOption === option.value ? "checked" : "";
        questionDiv.innerHTML += `<p><label>
            <input type="radio" id="option${index}" name="option" value="${option.value}" ${checked} ${disabled}>
            <span for="option${index}">${option.text}</span>
        </label></p>`;
    });

    // Re-process MathJax content
    MathJax.typesetPromise([questionDiv]).catch(function (err) {
        console.error('Error reprocessing MathJax', err);
    });
}

function gradeExam() {
    timer.stop();
    if(!currentSession) {
        window.location.href = 'index.html';
        console.log("No se encontraron los datos de la sesión");
    }
    let score = 0;
    currentSession.history.forEach(question => {
        if (question.answer === question.selectedOption) {
            //console.log("q: " + question.id + ", a:" + question.answer, ", s:" + question.selectedOption);
            score++;
        }
    });
    //console.table(questionHistory);

    if(score <= maxQuestions * 0.5) {   
        //Reprobado
        loadResultContent("./result1.html");
    }
    else if(score > maxQuestions * 0.5 && score <= maxQuestions * 0.7) {
        //Bueno
        loadResultContent("./result2.html");
    }
    else {
        //Excelente
        loadResultContent("./result3.html");
    }
    let scoreDiv = document.getElementById("scoreDiv");
    scoreDiv.innerHTML = `<h3> Puntuación: ${score}/${maxQuestions}</h3>`;
    
    switchButtons();
}

function loadResultContent(url) {
    fetch(url)
        .then(response => response.text())
        .then(html => {
            document.getElementById('introductionDisplay').innerHTML = html;
        })
        .catch(error => console.error('Error loading the content:', error));
}

function checkResults() {
    currentSession.index = 0;
    loadQuestion();
    switchButtons();
    M.toast({html: 'Revisión del examen.', classes: 'rounded'});
}

function checkAnswer() {
    const options = document.getElementsByName('option');
    selectedOption = Array.from(options).find(opt => opt.checked);
    if (!selectedOption) {
        M.toast({html: 'Por favor, seleccione una respuesta.', classes: 'rounded'});
        return false;
    }
    if (selectedOption.value === currentQuestion.answer) {
        M.toast({html: 'Respuesta correcta!', classes: 'rounded green'});
    } else {
        M.toast({html: 'Respuesta incorrecta!', classes: 'rounded red'});
    }
    return true;
}

function switchButtons() {
    isEvaluationStarted = currentSession && currentSession.index < currentSession.history.length;
    document.getElementById('introductionDisplay').style.display = (isEvaluationStarted ? 'none' : 'block');
    document.getElementById('workarea').style.display = (isEvaluationStarted ? 'block' : 'none');
    //document.getElementById('startBtn').style.display = (isEvaluationStarted ? 'none' : 'block');
    //document.getElementById('returnBtn').style.display = (isEvaluationStarted ? 'none' : 'block');
    //document.getElementById('prevBtn').style.display = (isEvaluationStarted ? 'block' : 'none');
    //document.getElementById('nextBtn').style.display = (isEvaluationStarted ? 'block' : 'none');
    document.getElementById('endBtn').style.display = (isEvaluationStarted ? 'block' : 'none');
    
    document.getElementById('prevBtn').style.display = (isEvaluationStarted && currentSession.index > 0 ? 'block' :'none');
    document.getElementById('nextBtn').style.display = (isEvaluationStarted && currentSession.index < maxQuestions ? 'block' : 'none');
}

function updateProgress() {
    document.getElementById('progress-c85361ab-c23e-4425-bb74-c5d1b5453e66').innerText = `Reactivo ${currentSession.index + 1}/${maxQuestions}`;
}

document.addEventListener('DOMContentLoaded', async () => {
    currentSession = await getCurrentSession();

    // Uso del objeto TimeCounter
    let timerElement = document.getElementById('time');
    timer = new TimeCounter(timerElement);

    if (currentSession) {
        timer.hours = currentSession.hours;
        timer.minutes = currentSession.minutes;
        timer.seconds = currentSession.seconds;
        timer.print();
        timer.start();
        loadQuestion(); // Carga la pregunta desde la sesión guardada
    }

    switchButtons();
    
    let startBtn = document.getElementById('startBtn');
    if(startBtn) {
        startBtn.addEventListener('click', async () => {
            clearCurrentSession();
            await loadQuestion();
            switchButtons();
            timer.start();
        });
    }
    
    let nextBtn = document.getElementById('nextBtn');
    nextBtn.addEventListener('click', function() {
        if(checkAnswer() === true){
            currentSession.index++;
            currentQuestion.selectedOption = selectedOption.value;
            saveCurrentSession(currentQuestion);
            loadQuestion();  // Carga nueva pregunta sólo después de la verificación
        }
    });
   
    let prevBtn = document.getElementById('prevBtn');
    prevBtn.addEventListener('click', function() {
        currentSession.index--;
        loadQuestion(); 
    });

    /* Bloqueo de menú contextual, Ctrl+C y Ctrl+V */
    document.addEventListener('contextmenu', function(event) {
        event.preventDefault();
    });

    document.addEventListener('keydown', function(event) {
        // Verificar si la tecla Control está presionada junto con C (copiar)
        if (event.ctrlKey && event.key === 'c') {
            //event.preventDefault();
            M.toast({html: 'Acción no permitida', classes: 'rounded'});
        }
    
        // Verificar si la tecla Control está presionada junto con V (pegar)
        if (event.ctrlKey && event.key === 'v') {
            //event.preventDefault();
            M.toast({html: 'Acción no permitida', classes: 'rounded'});
        }
    });

});

