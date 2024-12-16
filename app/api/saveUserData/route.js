import { TableClient } from "@azure/data-tables";

export async function POST(req) {
  try {
    // Parse the incoming request body (user data)
    const { firstName, lastName, email, password, photoUrl } = await req.json();

    // Get the connection string from environment variables
    const connectionString = process.env.AZURE_TABLES_CONNECTION_STRING;

    // Initialize the TableClient using the connection string
    const client = TableClient.fromConnectionString(connectionString, "Users");

    // Create a user entity to insert into Table Storage
    const userEntity = {
      partitionKey: "user",     // Common partition key
      rowKey: email,            // Unique row key based on email
      firstName,                // First name field
      lastName,                 // Last name field
      email,                    // Email field
      password,                 // Password field
      photoUrl,                 // URL of the uploaded photo (this will be updated later)
    };

    // Insert or update the user data into the "Users" table
    await client.upsertEntity(userEntity);  // Use upsert to insert or update

    // Return a success response
    return new Response(JSON.stringify({ message: "User data saved successfully" }), { status: 201 });
  } catch (error) {
    // If there's an error, log it and return a failure response
    console.error("Error saving user data:", error);
    return new Response(JSON.stringify({ error: "Failed to save user data", details: error.message }), { status: 500 });
  }
}
