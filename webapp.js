const express = require('express');
const session = require('express-session');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./key.json');
const app = express();

//  To use post method  
app.use(express.json()); // For parsing application/json
app.use(express.urlencoded({ extended: true }));

//  for password hashing 
var passwordHash = require('password-hash');


// Initialize Firebase
initializeApp({
    credential: cert(serviceAccount)
});
const db = getFirestore();
app.set("view engine","ejs");

app.use(express.static('public'));

// Generate a random secret key
const generateSecretKey = () => {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
};

const actualSecretKey = generateSecretKey();
// Set up express-session middleware
app.use(session({
    secret: actualSecretKey,
    resave: false,
    saveUninitialized: true
}));

// Serve static files from a directory (e.g., HTML files)
app.use(express.static(__dirname));

let admin_email;
let admin_name;
let complaintsArray = [];
let kmail;
let kame;
let kassword;

// LOGIN PAGE
app.get('/', function(req, res) {
    res.sendFile(__dirname + '/login_page.html');
});  

// USER SIGNIN ROUTE 
app.post('/signin_verify', function(req, res) {
    var inputData = req.body;
    var name = inputData.Name;
    var roll = inputData.roll;
    var email = inputData.email;
    var password = passwordHash.generate(inputData.password1);
    var hostel = inputData.hostel;
    var room = inputData.room;
    
    // Check if the email is already present in the Firestore collection
    db.collection('complaint')
        .where('Email', '==', email)
        .get()
        .then((querySnapshot) => {
            if (!querySnapshot.empty) {
                // Email already exists, send a response indicating the user is already logged in
                res.render('already_user',{

                });
            } else {
                // Email is not present, add data to the Firestore collection
                db.collection('complaint')
                    .add({
                        Name: name,
                        roll: roll,
                        Email: email,
                        Password: password,
                        Hostel: hostel,
                        Room: room,
                    })
                    .then((docRef) => {
                        console.log('Document written with ID: ', docRef.id);
                        res.render('signin_success', {});
                    })
                    .catch((error) => {
                        console.error('Error adding document: ', error);
                        res.status(500).send('An error occurred while adding the document.');
                    });
            }
        })
        .catch((error) => {
            console.error('Error checking for existing email: ', error);
            res.status(500).send('An error occurred while checking for existing email.');
        });
});

// ADMIN LOGIN ROUTE
app.post('/admin_login', function(req, res) 
{
    var email = req.body.email1;
    var password = req.body.password1;
    db.collection('admin')
        .where('email', '==', email)
        .get()
        .then((docs) => {
            // console.log("Docs:", docs.docs); // Log retrieved documents
        if (docs.empty) {
        console.log("No matching documents");
        res.send("You Entered Incorrect Details");
        return;
        }

            const user = docs.docs[0].data();
            
        // Verify the password
        if (passwordHash.verify(password, user.password)) {
            req.session.email1 = user.email; // Use lowercase 'email'
            req.session.name = user.Name;
            req.session.password = user.password;
            admin_email=user.email;
            admin_name=user.Name; // Use lowercase 'password'
            res.render("admin_dashboard", {
                Email: req.session.email1,
                Name: req.session.name
            });
        } else {
            return Promise.reject('Incorrect Password'); // Reject with an error message
          }
        })
        .catch((error) => {
            console.error('Error:', error);
            res.status(500).send('An error occurred.');
        });
});

// USER LOGIN ROUTE
app.post('/user_login', function (req, res, next) {
    const email = req.body.email;
    const password = req.body.password;
    db.collection('complaint')
      .where('Email', '==', email)
      .get()
      .then((docs) => {
        if (docs.empty) {
          return Promise.reject('Please Signin to continue'); // Reject with an error message
        }
        const user = docs.docs[0].data();
        // Verify the password
        if (passwordHash.verify(password, user.Password)) {
          // Password is correct, set session variables
          req.session.email = user.Email;
          req.session.name = user.Name;
          req.session.password = user.Password;
          kmail = user.Email;
          kame = user.Name;
          kassword = user.Password;

          // Continue with retrieving complaints or other actions
          const complaintPromises = docs.docs.map((doc) => {
            return doc.ref
              .collection('Complaint')
              .get()
              .then((each) => {
                const complaints = each.docs.map((complaintDoc) => {
                  return complaintDoc.data().Complaint;
                });
                return complaints;
              });
          });

          return Promise.all(complaintPromises);
        } else {
          return Promise.reject('Incorrect Password'); // Reject with an error message
        }
      })
      .then((complaintsData) => {
        complaintsArray = complaintsData.flat(); // Update the global variable

        // After setting kmail and kame, redirect to '/index'
        res.redirect('/index');
      })
      .catch((error) => {
        console.error('Error:', error);

        // Send the error response here
        res.status(500).send(error); // Send the error message as the response
      });
});

// USER LOGIN PAGE ROUTES

//INDEX ROUTE USER LOGIN PAGE 
app.get('/index', (req, res) => {
    res.render('index', {
      Email: kmail,
      Name: kame,
      Array: complaintsArray,
    });
  });

// REQUEST ROUTE            PREVIOUS COMPLAINTS RAISED BY USER
app.get('/request', (req, res) => {
      
        db.collection('complaint')
          .where('Email', '==', kmail)
          .where('Password', '==', kassword)
          .get()
          .then((docs) => {
            if (docs.empty) {
              res.send('You Entered Incorrect Details');
              return;
            }
            const user = docs.docs[0].data();
            req.session.email = user.Email;
            req.session.name = user.Name;
            req.session.password = user.Password;
            const complaintPromises = docs.docs.map((doc) => {
              return doc.ref
                .collection('Complaint')
                .get()
                .then((each) => {
                  const complaints = each.docs.map((complaintDoc) => {
                    return complaintDoc.data().Complaint;
                  });
                  return complaints;
                });
            });
      
            return Promise.all(complaintPromises);
          })
          .then((complaintsData) => {
            complaintsArray = complaintsData.flat(); // Update the global variable
            console.log(complaintsArray)
            // After setting kmail and kame, redirect to '/index'
            res.render('request', {
                Array: complaintsArray
              });
          })
          .catch((error) => {
            console.error('Error:', error);
            res.status(500).send('An error occurred.');
          });
     
    });

// DELETE ROUTE             PREVIOUS COMPLAINTS DELETE OPTION
    app.get('/delete', function(req, res) {
        var email = req.session.email;
        var password = req.session.password;
        var del = req.query.delete;
        console.log("Entered to delete route to delete =", del, email, password);
    
        var a = [];
    
        db.collection('complaint')
            .where('Email', '==', email)
            .where('Password', '==', password)
            .get()
            .then((docs) => {
                const promises = [];
                docs.forEach((doc) => {
                    const docRef = doc.ref;
                    let complaintIndex = 0; // To keep track of the index
    
                    docRef.collection('Complaint').get().then((each) => {
                        each.forEach((complaintDoc) => {
                            // Check if the index is 1 (second document)
                            
    
                            if (complaintDoc.data().Complaint === del) {
                                // Add the document reference to the promises for deletion
                                promises.push(complaintDoc.ref.delete());
                            } else {
                                console.log(del,complaintDoc.data().Complaint);
                                a.push(complaintDoc.data().Complaint);
                            }
    
                            complaintIndex++;
                        });
    
                        // Return the promise chain to ensure proper sequencing
                        return Promise.all(promises);
                    })
                    .then(() => {
                        console.log("Complaints Requested Before: " + a.join(', '));
                        res.render('delete_comp', {
                    
                        }); // Send a success response
                        
                    })
                    .catch((error) => {
                        console.error('Error during deletion:', error);
                        res.status(500).send('An error occurred during deletion.');
                    });
                });
            })
            .catch((error) => {
                console.error('Error fetching documents:', error);
                res.status(500).send('An error occurred while fetching documents.');
            });
    });

// COMPLAINT ROUTE          MAKE A COMPLAINT BY USER 
app.get('/complaint', (req, res) => {
    
    res.render('complaint', {
        Array: complaintsArray,
      });
});

// COMPLAINT SUBMISSION ROUTE
app.get('/comp', function(req, res) {
    var input = req.query;
    var complaint = input.a2;
    var email = req.session.email;
    var password=req.session.password;
    const query = db.collection('complaint').where('Email', '==', email).where('Password',"==",password);
    query.get()
        .then((docs) => {
            const updatePromises = [];
            docs.forEach((doc) => {
                const docRef = doc.ref;
                const nestedCollectionRef = docRef.collection('Complaint'); // Replace with your nested collection name
                updatePromises.push(
                    nestedCollectionRef.add({
                        Complaint: complaint
                    })
                );
            });
            // Execute all update promises
            return Promise.all(updatePromises);
        })
        .then(() => {
            res.render('comp_succ', {
                
              });
        })
        .catch((error) => {
            console.error('Error updating documents:', error);
            res.status(500).send('An error occurred while updating the documents.');
        });
});

// SERVICE ROUTE            COMPLAINTS SERVICED BY ADMIN
app.get('/ser', function (req, res) {
    // Assuming you have the complaint document field and value to filter by
    const complaintField = 'Email'; // Replace with the actual field name
    const complaintValue = req.session.email; // Replace with the desired field value

    // Reference to the "complaints" collection
    const complaintsCollectionRef = db.collection('complaint');

    // Query for "Serviced" documents based on the condition
    complaintsCollectionRef
        .where(complaintField, '==', complaintValue)
        .get()
        .then((querySnapshot) => {
            const documents = [];

            // Iterate through the filtered "complaints" documents
            querySnapshot.forEach((complaintDoc) => {
                // Reference to the nested "Serviced" collection within the complaint document
                const servicedCollectionRef = complaintDoc.ref.collection('Serviced');

                // Retrieve documents from the nested "Serviced" collection
                servicedCollectionRef.get()
                    .then((snapshot) => {
                        snapshot.forEach((doc) => {
                            
                            documents.push(doc.data().Serviced);
                        });
                        console.log(documents);
                        // Render the "userserved.ejs" template with the documents
                        res.render('service', { Doc: documents });
                    })
                    .catch((error) => {
                        console.error('Error fetching documents from Serviced collection:', error);
                        res.status(500).send('An error occurred while fetching documents.');
                    });
            });
        })
        .catch((error) => {
            console.error('Error fetching complaint documents:', error);
            res.status(500).send('An error occurred while fetching documents.');
        });
});

// ADMIN ROUTES

// ADMIN DASHBOARD ROUTE
app.get('/admin_dash',function(req,res){
    res.render("admin_dash",{
        Email :admin_email,
        Name : admin_name
    })
})

// COMPLAINTS ROUTE             ALL COMPLAINTS RAISED BY USERS 
app.get('/cc', async function(req, res, next) {
    const emailComplaintsMap = new Map();

    try {
        const docs = await db.collection('complaint').get();

        if (docs.empty) {
            res.send("You Entered Incorrect Details");
            return;
        }

        await Promise.all(docs.docs.map(async (doc) => {
            const user = doc.data();
            const imail = user.Email;
            const iname = user.Name;

            if (!emailComplaintsMap.has(imail)) {
                emailComplaintsMap.set(imail, []);
            }

            const promises = await doc.ref.collection('Complaint').get();
            const complaints = promises.docs.map((complaintDoc) => {
                return complaintDoc.data().Complaint;
            });

            emailComplaintsMap.get(imail).push({ Name: iname, Complaints: complaints });
        }));

        const renderData = [];
        emailComplaintsMap.forEach((complaints, email) => {
            renderData.push({ Email: email, Complaints: complaints });
        });
        res.render("admin_usercomplaints", {
            Data: renderData
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('An error occurred.');
    }
});

// COMPLAINT SUCCESS ACCEPTANCE ROUTE
app.get('/alldel', function (req, res) {
    var email = req.query.email;
    var del = req.query.delete;
    console.log(email);
    console.log("entered to delete route to delete =", del);
    var a = [];

    // Step 1: Fetch the documents from the "complaint" collection
    db.collection('complaint')
        .where('Email', '==', email)
        .get()
        .then((docs) => {
            const promises = [];

            docs.forEach((doc) => {
                const docRef = doc.ref;
                let complaintIndex = 0; // To keep track of the index

                docRef.collection('Complaint').get().then((each) => {
                    each.forEach((complaintDoc) => {
                        // Check if the document matches the one to delete
                        if (complaintDoc.data().Complaint === del) {
                            // Add the document reference to the promises for deletion
                            promises.push(complaintDoc.ref.delete());
                        } else {
                            a.push(complaintDoc.data().Complaint);
                        }
                        complaintIndex++;
                    });

                    // Return the promise chain to ensure proper sequencing
                    return Promise.all(promises);
                })
                .then(() => {
                })
                .catch((error) => {
                    console.error('Error fetching or deleting nested collection documents:', error);
                    res.status(500).send('An error occurred while fetching or deleting nested collection documents.');
                });

                // Step 2: Add a "Serviced" record to the "serviced" nested collection
                const servicedCollectionRef = docRef.collection('Serviced'); // Nested collection within each "Complaint" document
                servicedCollectionRef.add({
                    Serviced: del
                });

                // Step 3: Add a "Serviced" record to a nested collection within the "admin" collection
                const adminCollectionRef = db.collection('served'); // Replace with the actual name of the "admin" collection                                                  // Nested collection within each "admin" document
                adminCollectionRef.add({
                    Email: email,
                    Serviced: del                  
                });
            });

            res.render('served_admin', {
                
            });
        })
        .catch((error) => {
            console.error('Error:', error);
            res.status(500).send('An error occurred.');
        });
});

// COMPLETED ROUTE              COMPLAINTS SERVICED BY USER 
app.get('/completed', function (req, res) {
    const servicedCollectionRef = db.collection('served'); // Replace with the actual name of your "Serviced" collection

    // Retrieve documents from the "Serviced" collection
    servicedCollectionRef.get()
        .then((snapshot) => {
            const documents = [];

            snapshot.forEach((doc) => {
                documents.push(doc.data());
            });

            // Render the "served.ejs" template with the documents
            res.render('admin_serviced', { Doc:documents });
        })
        .catch((error) => {
            console.error('Error fetching documents:', error);
            res.status(500).send('An error occurred while fetching documents.');
        });
});


// app.get('/service', (req, res) => {
//     res.render('service'); // Render 'request.ejs' located in the 'views' directory
//   });



app.listen(3000, function() {
    console.log('Server is working');
});