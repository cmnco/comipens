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

async function loadQuestion() {
    const files = ["questions1.json", "questions1.json", "questions1.json"];
    const selectedFile = getRandomElement(files);
    const questions = await fetchQuestionFile(selectedFile);
    if (questions) {
        const question = getRandomElement(questions);
        displayQuestion(question);
    }
}

function displayQuestion(question) {
    const questionDiv = document.getElementById('questionDisplay');
    questionDiv.innerHTML = `<div class="question"><p>${question.ask}</p></div>`;
    if(question.expression){
        questionDiv.innerHTML += `<div class="center"><p>${question.expression}</p></div>`;
    }
    question.options.forEach((option, index) => {
        questionDiv.innerHTML += `<p><label>
            <input type="radio" id="option${index}" name="option" value="${option}">
            <span for="option${index}">${option}</span>
        </label></p>`;
    });

    // Le pedimos a MathJax que vuelva a procesar el contenido del DOM en 'questionDiv'
    MathJax.typesetPromise([questionDiv]).catch(function (err) {
        console.error('Error reprocessing MathJax', err);
    });
}

document.addEventListener('DOMContentLoaded', loadQuestion);
