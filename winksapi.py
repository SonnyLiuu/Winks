import hashlib
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi


def createUser(username, password):
    if users_collection.find_one({"username": username}):
        #Warn user that username is already taken
        print("Username already taken. Please try another.")
        print(users_collection.find_one({"username": username}))
        return False
    passHash = hashlib.sha256((str(password)).encode())
    print(passHash.hexdigest())
    newUser = {"username": username, "password": passHash.hexdigest()}
    inserted_id = users_collection.insert_one(newUser).inserted_id
    print(inserted_id)
    return True #sentinel value for validating function successfully created user profile

def login(username, password):
    passHash = hashlib.sha256((str(password)).encode())
    user = users_collection.find_one({"username": username, "password": passHash.hexdigest()})
    if (user==None):
        print("Could not find an account with that username or password")
    return user

def setSetting(settingName, setting, user):
    key = user["_id"]
    settingsProfile = settings_collection.find_one({"_id":key})
    if settingsProfile == None: #Profile for user doesn't exist yet, make one
        settings_collection.insert_one({"_id":key, settingName:setting})
    else:
        settings_collection.update_one({"_id":key}, {"$set": {settingName:setting}})
    print("Setting ", settingName, " updated to ", setting, " successfully!")
    
def getSetting(settingName, user): #returns the setting the user has stored in Mongo on a successful match with a given user JSON, else returns None
    key = user["_id"]
    settingsProfile = settings_collection.find_one({"_id":key})
    if settingsProfile == None: #No setting for that user found
        return None
    else:
        return settingsProfile[settingName]

uri = "mongodb+srv://root:RickLinebacker123@winks.n0ibi.mongodb.net/?retryWrites=true&w=majority&appName=Winks"
# Create a new client and connect to the server
client = MongoClient(uri, server_api=ServerApi('1'))
# Send a ping to confirm a successful connection
try:
    client.admin.command('ping')
    print("Pinged your deployment. You successfully connected to MongoDB!")
except Exception as e:
    print(e)
    

db = client["User_Profiles"] #Database object
settings_collection = db["Settings"] #Variable for accessing the "Settings" table/collection of the database
users_collection = db["Profiles"] #Variable for accessing the "Users" table/collection of the database


'''#createUser("username1", "password")
user = login("username1", "password")
print("Logged in as ", user)

#Test setting user preferences
setSetting("leftwink", 12, user)
print(getSetting("leftwink", user))'''