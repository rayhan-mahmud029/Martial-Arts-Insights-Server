const express = require('express');
const cors = require('cors');
require('dotenv').config()

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('martial arts insights server running')
})

// MONGO DB CODE STARTS HERE
const { MongoClient, ServerApiVersion } = require('mongodb');
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