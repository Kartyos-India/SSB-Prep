// This script ONLY runs on gto.html

const pageContent = document.getElementById('page-content');

// Store GTO task information in an object for easy access
const gtoTasks = {
    pgt: {
        title: "Progressive Group Task (PGT)",
        description: "In PGT, the group is required to cross a series of obstacles using helping materials like a plank, pole, and rope. The difficulty of the obstacles progressively increases. It tests your ability to contribute ideas and work as a team under pressure."
    },
    hgt: {
        title: "Half Group Task (HGT)",
        description: "HGT is similar to PGT but conducted with a smaller group (half the original). The obstacle is generally the same as one of the PGT obstacles. This gives candidates who were quiet in the larger group a better chance to showcase their leadership and ideas."
    },
    ct: {
        title: "Command Task (CT)",
        description: "In the Command Task, you are appointed as the commander and must lead two subordinates (chosen from your group) to complete an assigned obstacle. This task directly assesses your qualities as a leader, including planning, communication, and motivating your team."
    },
    fgt: {
        title: "Final Group Task (FGT)",
        description: "The FGT is the last outdoor task, similar in nature to the PGT. It's the final opportunity for the group to work together and demonstrate the teamwork and coordination they've learned throughout the GTO series."
    },
    gd: {
        title: "Group Discussion (GD)",
        description: "Two group discussions are conducted on topical social or current affairs issues. This tests your general awareness, communication skills, and ability to influence a group with logical and well-reasoned points."
    },
    lecturette: {
        title: "Lecturette",
        description: "You are given a card with four topics, from which you choose one to speak on for three minutes. This assesses your confidence, clarity of thought, communication skills, and knowledge on a variety of subjects."
    }
};

// Function to show the details of a specific task
function renderTaskDetails(taskKey) {
    const task = gtoTasks[taskKey];
    pageContent.innerHTML = `
        <div class="text-center mb-6">
            <h2 class="text-3xl font-bold">${task.title}</h2>
        </div>
        <div class="bg-white p-6 rounded-lg shadow-md max-w-2xl mx-auto">
            <p class="text-gray-700 leading-relaxed">${task.description}</p>
        </div>
        <div class="text-center mt-8">
            <button id="back-to-gto-menu" class="back-btn py-2 px-6 rounded-lg font-semibold">← Back to GTO Menu</button>
        </div>
    `;
    document.getElementById('back-to-gto-menu').addEventListener('click', renderGTOMenu);
}

// Function to show the main menu of all GTO tasks
function renderGTOMenu() {
    pageContent.innerHTML = `
        <div class="text-center">
            <h2 class="text-4xl font-bold">GTO TASKS OVERVIEW</h2>
            <p class="text-gray-500 mt-2">Select a task to learn more about it.</p>
        </div>
        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto pt-8">
            ${Object.keys(gtoTasks).map(key => `
                <div class="choice-card p-6 text-center flex flex-col rounded-lg">
                    <h3 class="text-xl font-bold mt-3">${gtoTasks[key].title}</h3>
                    <button class="w-full primary-btn font-bold py-3 mt-6 rounded-lg" data-task="${key}">
                        View Details
                    </button>
                </div>
            `).join('')}
        </div>
    `;

    // Add event listeners to all the "View Details" buttons
    pageContent.querySelectorAll('button[data-task]').forEach(button => {
        button.addEventListener('click', () => {
            renderTaskDetails(button.dataset.task);
        });
    });
}

// Initial render when the gto.html page loads
if (pageContent) {
    renderGTOMenu();
}
