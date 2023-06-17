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
        const feedbacksCollection = client.db("MartialArtsInsights").collection('feedbacks');
        const paymentsCollection = client.db("MartialArtsInsights").collection('payments');
        const usersCollection = client.db("MartialArtsInsights").collection('users');

        // get classes 
        app.get('/classes', async (req, res) => {
            const { sortField, sortOrder } = req.query;
            // console.log(sortField, sortOrder);
            if (sortField && sortOrder) {
                const query = classesCollection.find().sort({ [sortField]: sortOrder === 'asc' ? 1 : -1 });
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


        app.post('/selected-classes', async (req, res) => {
            const classItem = req.body;
            // console.log(classItem);
            const result = await selectedClassesCollection.insertOne(classItem);
            res.send(result);
        })
        // get stored classes data
        app.get('/selected-classes', async (req, res) => {
            const email = req.query.email;
            // console.log(email);
            const query = { userEmail: email };
            const result = await selectedClassesCollection.find(query).toArray();
            res.send(result);
        })

        app.delete('/selected-classes/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await selectedClassesCollection.deleteOne(query);
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
            // console.log(payment.paymentInfo);
            const insertResult = await paymentsCollection.insertOne(payment.paymentInfo);

            const query = { _id: { $in: payment.paymentInfo.paidClassItems.map(id => new ObjectId(id)) } };
            const deleteResult = await selectedClassesCollection?.deleteMany(query);

            // reduce available seats in class
            // Update the availableSeats field using pipeline
            const updateResult = await classesCollection?.updateMany(
                { _id: { $in: payment.paymentInfo.classItems.map(id => new ObjectId(id)) } },
                [{ $set: { availableSeats: { $subtract: ['$availableSeats', 1] } } }]
            );

            res.send({ insertResult, deleteResult, updateResult });
        })

        app.get('/payments', async (req, res) => {
            const { sortField, sortOrder } = req.query;
            const email = req.query.email;
            const query = { email: email };
            const result = await paymentsCollection.find(query).sort({ [sortField]: sortOrder === 'asc' ? 1 : -1 }).toArray();
            res.send(result);
        })


        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const existingUser = await usersCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exists' })
            }
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })

        // get stored users
        app.get('/users', async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })

        // Instructor activities
        // check instructor
        app.get('/users/instructor/:email', async (req, res) => {
            const email = req.params.email;

            // if (req.decoded.email !== email) {
            //     console.log(req.decoded.email, email);
            //     return res.send({ admin: false });
            // }
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const result = { admin: user?.role === 'instructor' };
            // console.log(result);
            res.send(result);
        })


        app.post('/classes', async (req, res) => {
            const { newItem } = req.body;
            const result = await classesCollection.insertOne(newItem);
            res.send(result)
        })

        // get instructor class
        app.get('/classes/:email', async (req, res) => {
            const email = req.params.email;
            // console.log(email);
            const query = { instructorEmail: email };
            const result = await classesCollection.find(query).toArray();
            res.send(result);
        })

        app.get('/feedbacks/:id', async (req, res) => {
            const id = req.params.id;
            const query = { classID: id };
            const result = await feedbacksCollection.find(query).toArray();
            res.send(result);
        })


        // Admin Activities
        // check is admin
        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            // console.log(email, 'admin');

            // if (req.decoded.email !== email) {
            //     console.log(req.decoded.email, email);
            //     return res.send({ admin: false });
            // }
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const result = { admin: user?.role === 'admin' };
            // console.log(result);
            res.send(result);
        })

        // Update class status
        app.patch('/classes/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const { status } = req.body;
            const updateDoc = {
                $set: {
                    status: status
                }
            }
            const result = await classesCollection.updateOne(query, updateDoc);
            res.send(result)
        })

        // update user role
        app.patch('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const { role } = req.body;
            const updateDoc = {
                $set: {
                    role: role
                }
            }
            const result = await usersCollection.updateOne(query, updateDoc);
            res.send(result);
        })

        // admin feedback store
        app.post('/feedbacks', async (req, res) => {
            const { feedback } = req.body;
            const result = await feedbacksCollection.insertOne(feedback);
            res.send(result)
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