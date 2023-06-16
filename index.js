const express = require('express');
const cors = require('cors');
require('dotenv').config()

const app = express();
const port = process.env.PORT || 5000;

// STRIPE secret API key.
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('martial arts insights server running')
})

// MONGO DB CODE STARTS HERE
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1o3onh9.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        // collections
        const classesCollection = client.db("MartialArtsInsights").collection('classes');
        const instructorsCollection = client.db("MartialArtsInsights").collection('instructors');
        const selectedClassesCollection = client.db("MartialArtsInsights").collection('selectedClasses');
        const paymentsCollection = client.db("MartialArtsInsights").collection('payments');

        // get classes 
        app.get('/classes', async (req, res) => {
            const { sortField, sortOrder } = req.query;
            console.log(sortField, sortOrder);
            if (sortField && sortOrder) {
                const query = await classesCollection.find().sort({ [sortField]: sortOrder === 'asc' ? 1 : -1 });
                const sortedData = await query.toArray();
                res.send(sortedData)
            } else {
                const result = await classesCollection.find().toArray();
                res.send(result);
            }
        })

        // get instructors data
        app.get('/instructors', async (req, res) => {
            const result = await instructorsCollection.find().toArray();
            res.send(result);
        })

        // store selected classes
        app.post('/selected-classes', async (req, res) => {
            const classItem = req.body;
            console.log(classItem);
            const result = await selectedClassesCollection.insertOne(classItem);
            res.send(result);
        })
        // get stored classes data
        app.get('/selected-classes', async (req, res) => {
            const email = req.query.email;
            console.log(email);
            const query = { userEmail: email };
            const result = await selectedClassesCollection.find(query).toArray();
            res.send(result);
        })



        // ADD PAYMENT INTENT
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseFloat(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: [
                    "card"
                ],
            });
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })

        // Store payments data
        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const insertResult = await paymentsCollection.insertOne(payment.paymentInfo);

            const query = { _id: { $in: payment.paymentInfo.paidClassItems.map(id => new ObjectId(id)) } };
            console.log(query);
            const deleteResult = await selectedClassesCollection.deleteMany(query);
            res.send({ insertResult, deleteResult });
        })




        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
    finally {
        // Ensures that the client will close when you finish/error
    }
}
run().catch(console.dir);


// MONGO DB CODE ENDS HERE


app.listen(port, () => {
    console.log('Server running in port ', port);
})