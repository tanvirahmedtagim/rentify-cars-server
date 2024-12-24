const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ez7m5.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const carsCollection = client.db("carDB").collection("car");
    const bookingCollection = client.db("carDB").collection("myBooking");

    // Fetch all cars with optional filtering
    app.get("/cars", async (req, res) => {
      const { carModel, location } = req.query;

      const query = {};
      if (carModel) query.carModel = carModel;
      if (location) query.location = location;

      const cars = await carsCollection.find(query).toArray();
      res.send(cars);
    });

    // Add a new car
    app.post("/cars", async (req, res) => {
      const newCar = req.body;
      const result = await carsCollection.insertOne(newCar);
      res.send(result);
    });

    // To get all car by a specific user myCars
    app.get("/myCars", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const cursor = carsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    //Delete myCars
    app.delete("/myCars/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await carsCollection.deleteOne(query);
      res.send(result);
    });
    // Update myCars
    app.patch("/myCars/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const options = { upsert: false };
      const updateCar = req.body;

      const car = {
        $set: {
          carModel: updateCar.carModel,
          rentalPrice: updateCar.rentalPrice,
          availability: updateCar.availability,
          registrationNumber: updateCar.registrationNumber,
          features: updateCar.features,
          description: updateCar.description,
          imageUrl: updateCar.imageUrl,
          location: updateCar.location,
        },
      };

      const result = await carsCollection.updateOne(query, car, options);
      res.send(result);
    });

    //for car details
    app.get("/cars/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await carsCollection.findOne(query);
      res.send(result);
    });

    //For My Bookings
    // Add to booking
    app.post("/myBooking", async (req, res) => {
      const bookingItems = req.body;
      const result = await bookingCollection.insertOne(bookingItems);

      
      res.send(result);
    });

  

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Rentify Cars Server is Running");
});

app.listen(port, () => {
  console.log(`Rentify Cars Server Is Running On port: ${port}`);
});
