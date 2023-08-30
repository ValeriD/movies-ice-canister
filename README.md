# ICP-Movies
This project allows user to execute basic CRUD commands for movies, register, login, logout and adding and removing movies from their watchlist.

## How to run the project
- Clone the repository
```
git clone https://github.com/ValeriD/movies-ice-canister.git
```
- Install dependencies
```
npm install
```
- Start DFX (omit `--clean` param on subsequent starts unless you'd like to start with clean data)
```
dfx start --background --clean
```
- Deploy canister
```
dfx deploy
```

## Use cases
- Create a user
```
dfx canister call movies createUser '(record { "name"="John Doe"; "email"="john.doe@example.org"; "password"="PreTTyStR0ng123"})'
```
You will get a message:
```
(
  variant {
    Ok = "Successfully registered user with email=john.doe@example.org"
  },
)
```
- Login with the user
```
dfx canister call movies loginUser '("john.doe@example.org", "PreTTyStR0ng123")'
```
You will get the message:
```
(variant { Ok = "Successfully logged in!" })
```
- Create a movie
```
dfx canister call movies createMovie '(record {"title"= "The Godfather"; "description"= "Italian mafia"; "genre"="criminal"; "imageURL"=""; "coverImageURL"="";})'
```
You will get the message:
```
(
  variant {
    Ok = record {
      id = "072a3c6d-f203-443b-a171-6e6d999e234d";
      coverImageURL = "";
      title = "The Godfather";
      createdAt = 1_693_432_009_664_466_000 : nat64;
      description = "Italian mafia";
      updateAt = null;
      imageURL = "";
      genre = "criminal";
    }
  },
)
```
- Add movie to the current logged user
```
dfx canister call movies addMovieToWatchlist '("072a3c6d-f203-443b-a171-6e6d999e234d")' 
```
You will get the message:
```
(
  variant {
    Ok = "Successfully added movie with id=072a3c6d-f203-443b-a171-6e6d999e234d to watchlist"
  },
)
```
- To check out the watchlist call:
```
dfx canister call movies getWatchlist '()'
```
The result is something like:
```
(
  variant {
    Ok = record {
      id = "9a717c90-4824-450c-8b6a-a0cd1e0fa8c1";
      movies = vec { "072a3c6d-f203-443b-a171-6e6d999e234d" };
    }
  },
)
```
