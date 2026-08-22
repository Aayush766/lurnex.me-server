const mongoose = require("mongoose");
const Assessment = require("./models/AssessmentModel"); // update path if needed

const MONGO_URI = "mongodb+srv://aayushverma7667:Aayush7667@cluster0.lpd7dbk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

const grade12Assessment = {
    title: "Grade 12 Science & Mathematics Assessment",
    description:
        "A Grade 12 level assessment covering important concepts from Physics, Chemistry and Mathematics. Visit lurnex.me for detailed learning resources and preparation.",
    duration: 30,
    targetGrades: ["12"],
    isPublished: true,
    questions: [
        {
            questionText:
                "According to Ohm's Law, the relationship between voltage (V), current (I), and resistance (R) is:",
            options: [
                "V = IR",
                "V = I/R",
                "V = R/I",
                "V = I²R"
            ],
            correctAnswer: "V = IR",
            subject: "Physics",
            difficulty: "easy",
            explanation:
                "Ohm's Law states that voltage across a conductor is directly proportional to current flowing through it, where V = IR."
        },

        {
            questionText:
                "A projectile is launched with an initial velocity. At the highest point of its trajectory, which quantity becomes zero?",
            options: [
                "Horizontal velocity",
                "Vertical velocity",
                "Acceleration",
                "Momentum"
            ],
            correctAnswer: "Vertical velocity",
            subject: "Physics",
            difficulty: "medium",
            explanation:
                "At the maximum height, the vertical component of velocity becomes zero while horizontal velocity remains constant."
        },

        {
            questionText:
                "The SI unit of electric potential difference is:",
            options: [
                "Ampere",
                "Volt",
                "Ohm",
                "Coulomb"
            ],
            correctAnswer: "Volt",
            subject: "Physics",
            difficulty: "easy",
            explanation:
                "Electric potential difference is measured in volts."
        },

        {
            questionText:
                "Which of the following compounds shows hydrogen bonding?",
            options: [
                "CH4",
                "H2O",
                "CO2",
                "NaCl"
            ],
            correctAnswer: "H2O",
            subject: "Chemistry",
            difficulty: "easy",
            explanation:
                "Water molecules form hydrogen bonds due to highly electronegative oxygen atoms."
        },

        {
            questionText:
                "The oxidation number of oxygen in H2O2 is:",
            options: [
                "-2",
                "-1",
                "0",
                "+1"
            ],
            correctAnswer: "-1",
            subject: "Chemistry",
            difficulty: "medium",
            explanation:
                "In peroxide compounds, oxygen has an oxidation state of -1."
        },

        {
            questionText:
                "Which of the following is an example of an electrophile?",
            options: [
                "OH-",
                "NH3",
                "NO2+",
                "Cl-"
            ],
            correctAnswer: "NO2+",
            subject: "Chemistry",
            difficulty: "medium",
            explanation:
                "Electrophiles are electron-deficient species that accept electrons."
        },

        {
            questionText:
                "The derivative of sin(x) with respect to x is:",
            options: [
                "cos(x)",
                "-cos(x)",
                "sin(x)",
                "-sin(x)"
            ],
            correctAnswer: "cos(x)",
            subject: "Mathematics",
            difficulty: "easy",
            explanation:
                "The standard derivative rule gives d(sin x)/dx = cos x."
        },

        {
            questionText:
                "If A is a square matrix and |A| = 0, then matrix A is:",
            options: [
                "Identity matrix",
                "Singular matrix",
                "Diagonal matrix",
                "Orthogonal matrix"
            ],
            correctAnswer: "Singular matrix",
            subject: "Mathematics",
            difficulty: "medium",
            explanation:
                "A matrix with determinant zero is called a singular matrix."
        },

        {
            questionText:
                "The probability of getting a head when a fair coin is tossed once is:",
            options: [
                "0",
                "1/2",
                "1",
                "2"
            ],
            correctAnswer: "1/2",
            subject: "Mathematics",
            difficulty: "easy",
            explanation:
                "A fair coin has two equally likely outcomes, head and tail."
        },

        {
            questionText:
                "The integration of 1/x with respect to x is:",
            options: [
                "x²/2 + C",
                "log|x| + C",
                "1/x² + C",
                "x + C"
            ],
            correctAnswer: "log|x| + C",
            subject: "Mathematics",
            difficulty: "medium",
            explanation:
                "The integral of 1/x is ln|x| + C."
        }
    ]
};


async function seedAssessment() {
    try {
        await mongoose.connect(MONGO_URI);

        console.log("MongoDB Connected");

        await Assessment.deleteMany({
            title: grade12Assessment.title
        });

        const assessment = await Assessment.create(grade12Assessment);

        console.log(
            "Assessment Created:",
            assessment._id
        );

        process.exit(0);

    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}


seedAssessment();