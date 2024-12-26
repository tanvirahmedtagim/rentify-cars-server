const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cookieParser = require("cookie-parser");
const app = express();
const port = process.env.PORT || 5000;

// const corsOptions = {
//   origin: ["https://rentify-cars.netlify.app", "http://localhost:5173"],

// };

app.use(
  cors({
    origin: ["https://rentify-cars.netlify.app", "http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ez7m5.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
};

// verifyToken
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).send({ message: "unauthorized access" });
  jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
  });

  next();
};

async function run() {
  try {
    const carsCollection = client.db("carDB").collection("car");
    const bookingCollection = client.db("carDB").collection("myBooking");

    //generate jwt
    app.post("/jwt", async (req, res) => {
      const email = req.body;
      //create token
      const token = jwt.sign(email, process.env.SECRET_KEY, {
        expiresIn: "365d",
      });
      res.cookie("token", token, cookieOptions).send({ success: true });
    });

    // logout || clear cookie from browser
    app.post("/logout", async (req, res) => {
      console.log("sfgdfg");
      res
        .clearCookie("token", {
          maxAge: 0,

          ...cookieOptions,
        })
        .send({ success: true });
    });

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

    //Home route car show

    app.get("/cars/recent", async (req, res) => {
      try {
        const recentCars = await carsCollection
          .find()
          .sort({ _id: -1 })
          .limit(8)
          .toArray();
        res.send(recentCars);
      } catch (error) {
        res.status(500).send({ error: "Failed to fetch recent cars" });
      }
    });

    // To get all car by a specific user myCars
    app.get("/myCars/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const decodedEmail = req.user?.email;
      if (decodedEmail !== email)
        return res.status(401).send({ message: "unauthorized access" });
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
    app.patch("/myCars/:id", verifyToken, async (req, res) => {
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
    app.get("/cars/:id", verifyToken, async (req, res) => {
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

      const filter = { _id: new ObjectId(bookingItems.carId) };
      const update = {
        $inc: { bookingCount: 1 },
      };
      const updateBookingCount = await carsCollection.updateOne(filter, update);
      res.send(result);
    });

    // Get user's bookings
    app.get("/myBooking/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const decodedEmail = req.user?.email;
      if (decodedEmail !== email)
        return res.status(401).send({ message: "unauthorized access" });
      const query = { email: email };
      const cursor = bookingCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // Update Booking Endpoint
    app.put("/myBooking/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const { bookingStatus, startDate, endDate, totalCost } = req.body;

      // Ensure all required fields are included
      if (!bookingStatus || !startDate || !endDate || !totalCost) {
        return res.status(400).send({ error: "Missing required fields" });
      }

      try {
        const filter = { _id: new ObjectId(id) };
        const update = {
          $set: {
            bookingStatus,
            startDate,
            endDate,
            totalCost,
          },
        };

        const result = await bookingCollection.updateOne(filter, update);

        if (result.matchedCount === 0) {
          return res.status(404).send({ error: "Booking not found" });
        }

        res.status(200).send({ message: "Booking updated successfully" });
      } catch (error) {
        console.error("Error updating booking:", error);
        res.status(500).send({ error: "Failed to update booking" });
      }
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
