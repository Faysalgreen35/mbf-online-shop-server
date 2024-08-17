const express = require('express');
const cors = require('cors');
const app = express();
const jwt = require('jsonwebtoken');
require('dotenv').config(); 
const port = process.env.PORT || 5000;

// middleware 

app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5ynzghe.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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

    const userCollection = client.db("spwdb").collection("users")
    
    const productCollection = client.db('spwdb').collection('products');

    // JWT related api 
    app.post('/jwt', async (req, res) => {

      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1d"
      })
      res.send({ token });
    })

    //middleware 
    const verifyToken = (req, res, next) => {
      console.log('inside verifyToken', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'forbidden Access' })
      }

      const token = req.headers.authorization.split(' ')[1]
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next();
      })

    }

    // use verify admin after verifytoken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });

      }
      next();
    }



    // user related api 
    app.get('/users/admin/:email', verifyToken, async (req, res) => {

      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'unauthorized access' })
      }

      const query = { email: email }
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user.role === 'admin';
      }
      res.send({ admin });
    })


    //users api
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {

      const result = await userCollection.find().toArray();
      res.send(result);
    })


    //create user database

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query)
      if (existingUser) {
        return res.send({ message: 'user already exist', insertedId: null })

      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    })

    //make admin

    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    // delete user 
    app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);;
    })

  //   app.get('/products', async (req, res) => {
  //     const page = parseInt(req.query.page) || 0;  // Default to page 0
  //     const size = parseInt(req.query.size) || 10;  // Default to 10 items per page
  //     const sortField = req.query.sortField || 'dateAdded';  // Default sort by dateAdded
  //     const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;  // Default ascending
  //     const brand = req.query.brand || '';  // Filtering by brand (optional)
  //     const category = req.query.category || '';  // Filtering by category (optional)
  //     const minPrice = parseFloat(req.query.minPrice) || 0;  // Minimum price filter
  //     const maxPrice = parseFloat(req.query.maxPrice) || Infinity;  // Maximum price filter
  
  //     // Building the query object
  //     const query = {
  //         price: { $gte: minPrice, $lte: maxPrice }  // Filtering by price range
  //     };
  
  //     if (brand) {
  //         query.brand = brand;
  //     }
  
  //     if (category) {
  //         query.category = category;
  //     }
  
  //     console.log('pagination query', page, size, sortField, sortOrder, query);
  
  //     try {
  //         const totalProducts = await productCollection.find(query).count();  // Get total count for filtered products
  //         const products = await productCollection.find(query)
  //             .sort({ [sortField]: sortOrder })  // Sorting by the specified field and order
  //             .skip(page * size)  // Pagination: skip to the correct page
  //             .limit(size)  // Pagination: limit the number of items per page
  //             .toArray();
  
  //         res.send({
  //             totalProducts,  // Send the total number of products
  //             products  // Send the paginated and sorted products
  //         });
  //     } catch (error) {
  //         console.error('Error fetching products:', error);
  //         res.status(500).send('Internal Server Error');
  //     }
  // });
  
    app.get('/products', async (req, res) => {
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      const sortField = req.query.sortField || 'price'; // default sort by price
      const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1; // default ascending
  
      console.log('pagination query', page, size, sortField, sortOrder);
  
      const result = await productCollection.find()
          .sort({ [sortField]: sortOrder })
          .skip(page * size)
          .limit(size)
          .toArray();
  
      res.send(result);
  });
  
    app.get('/productsCount', async(req, res) => {
        const count = await productCollection.estimatedDocumentCount();
        res.send({count});
    })



    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {

  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('spw db server is running')
})

app.listen(port, () => {
  console.log(`spw db is sitting on port ${port}`)
})
