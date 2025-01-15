const express = require('express');
const cors = require('cors');
const app = express();
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()

app.use(cors({
    origin: [
        'http://localhost:5173',
        'https://got-it-7ccaa.web.app',
        'https://got-it-7ccaa.firebaseapp.com'
    ],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

const verifyToken = (req, res, next) => {
    const token = req.cookies?.token; 
    if (!token) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: "Forbidden" });
        }

        req.user = decoded;
        next();
    });
};


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jrarr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

// Auth Related apis
app.post('/jwt', (req, res) => {
    const user = req.body;
    const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '5h' });

    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    })
        .send({ success: true })
})

app.post('/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    })
    .send({ success: true })
})

// lost and find related apis
const allCollection = client.db('whereIsIt').collection('lost');
const recoveriesCollection = client.db('whereIsIt').collection('recoveries');

app.get('/allItems', verifyToken, async (req, res) => {
    const cursor = allCollection.find();
    const result = await cursor.toArray();
    res.send(result);
})

app.post('/allItems', async (req, res) => {
    const newItem = req.body;
    const result = await allCollection.insertOne(newItem);
    res.send(result);
})

app.get('/allItems/:id', async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) }
    const result = await allCollection.findOne(query);
    res.send(result);
})

app.put('/allItems/:id', async (req, res) => {
    const id = req.params.id;
    const { status, ...updatedItem } = req.body;
    const filter = { _id: new ObjectId(id) };
    const updateDoc = { $set: updatedItem };
    if (status) {
        updateDoc.$set.status = status;
    }
    const result = await allCollection.updateOne(filter, updateDoc);
    res.send(result);
});

app.get("/latestItems", async (req, res) => {
    const result = await allCollection
        .find({})
        .sort({ date: -1 })
        .limit(6)
        .toArray();
    res.send(result);
});


app.post("/recoveries", async (req, res) => {
    const { itemId, title, recoveredLocation, recoveryDate, recoveredBy } = req.body;
    const recoveryData = {
        itemId,
        title,
        recoveredLocation,
        recoveryDate: new Date(recoveryDate),
        recoveredBy,
        recoveredAt: new Date(),
    };
    const recoveryResult = await recoveriesCollection.insertOne(recoveryData);
    const updateResult = await allCollection.updateOne(
        { _id: new ObjectId(itemId) },
        { $set: { status: "recovered" } }
    );

    res.send({
        message: "Recovery operation completed successfully",
        recoveryResult,
        updateResult,
    });
});

app.get("/recoveries", verifyToken, async (req, res) => {
    const cursor = recoveriesCollection.find();
    const recoveries = await cursor.toArray();
    res.send(recoveries);
});

app.get('/myItems', verifyToken, async (req, res) => {
    const email = req.query.email;
    const query = { "contact.email": email };
    const result = await allCollection.find(query).toArray();
    res.send(result);
});

app.delete('/myItems/:id', async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await allCollection.deleteOne(query);
    res.send(result);
})

app.get('/', (req, res) => {
    res.send('App is running');
})

app.listen(port, () => {
    console.log(`App working on port: ${port}`);
})