import { $query, $update, Record, StableBTreeMap, Vec, match, Result, nat64, ic, Opt, Principal } from 'azle';
import { v4 as uuidv4 } from 'uuid';

////////////////////////////////////////////////////////////////
// Interfaces
////////////////////////////////////////////////////////////////
type Movie = Record<{
    id: string,
    title: string,
    description: string,
    genre: string,
    imageURL: string,
    coverImageURL: string,
    createdAt: nat64,
    updateAt: Opt<nat64>,
}>

type MoviePayload = Record<{
    title: string,
    description: string,
    genre: string,
    imageURL: string,
    coverImageURL: string,
}>

type User = Record<{
    principal: Principal,
    name: string,
    createdAt: nat64,
    updateAt: Opt<nat64>,
    loggedIn: boolean,
}>

type UserPayload = Record<{
    name: string,
}>

type WatchList = Record<{
    id: string,
    movies: Vec<string>
}>

export const movieStorage = new StableBTreeMap<string, Movie>(0, 44, 1024)
const userStorage = new StableBTreeMap<Principal, User>(1, 44, 1024);
const userWatchlistStorage = new StableBTreeMap<Principal, WatchList>(2, 44, 2048)



////////////////////////////////////////////////////////////////
// User operations
////////////////////////////////////////////////////////////////

function getUserByPrincipal(): Result<User, string> {
    const user = userStorage.get(ic.caller())
    if(!user.Some){
        return Result.Err<User, string>(`User with principal=${ic.caller()} does not exist.`)
    }
    return Result.Ok(user.Some);
}

$update;
export function createUser(payload: UserPayload): Result<string, string> {
    const user = getUserByPrincipal();
    if (user.Ok) {
        return Result.Err<string, string>(`A User with principal=${ic.caller()} already exists!`);
    }

    const newUser: User = {principal: ic.caller(), createdAt: ic.time(), updateAt: Opt.None, loggedIn: false, ...payload };
    userStorage.insert(newUser.principal, newUser);

    userWatchlistStorage.insert(newUser.principal, { id: uuidv4(), movies: [] });
    return Result.Ok<string, string>(`A user with principal=${ic.caller().toString()} successfully created!`);
}

$update
export function loginUser(): Result<string, string> {
    const result = getUserByPrincipal();
    if (result.Err || !result.Ok) {
        return Result.Err<string, string>(result.Err);
    }
    const updatedUser: User  = {...result.Ok, loggedIn: true , updateAt: Opt.Some(ic.time())}
    userStorage.insert(ic.caller(), updatedUser)
    return Result.Ok(`Successfully logged in!`);
}

$update
export function logoutUser(): Result<string, string> {
    const result = getUserByPrincipal();
    if (result.Err || !result.Ok) {
        return Result.Err<string, string>(result.Err);
    }

    const updatedUser: User  = {...result.Ok, loggedIn: false , updateAt: Opt.Some(ic.time())}
    userStorage.insert(ic.caller(), updatedUser)

    return Result.Ok<string, string>(`Successfully logged out!`);
}

////////////////////////////////////////////////////////////////
// Movies operations
////////////////////////////////////////////////////////////////
$query
export function getMovies(): Result<Vec<Movie>, string> {
    return Result.Ok<Vec<Movie>, string>(movieStorage.values());
}

$query;
export function getMovieById(id: string): Result<Movie, string> {
    return match(movieStorage.get(id), {
        Some: (movie) => Result.Ok<Movie, string>(movie),
        None: () => Result.Err<Movie, string>(`A movie with id=${id} not found`)
    })
}

$query;
export function getMovieByTitle(title: string): Result<Movie, string> {
    if(title.trim().length === 0){
        return Result.Err('Empty title')
    }
    const movies = movieStorage.values();
    const movieIndex = movies.findIndex(movie => movie.title === title);
    if(movieIndex === -1){
        return Result.Err(`A movie with title=${title} not found`)
    }
    return Result.Ok<Movie, string>(movies[movieIndex])
}

$update;
export function createMovie(payload: MoviePayload): Result<Movie, string> {
    if(payload.title.trim().length === 0){
        return Result.Err('Empty title')
    }
    const result = getUserByPrincipal();
    if (result.Err || !result.Ok) {
        return Result.Err(result.Err);
    }
    const movie: Movie = { id: uuidv4(), createdAt: ic.time(), updateAt: Opt.None, ...payload };
    movieStorage.insert(movie.id, movie);
    return Result.Ok<Movie, string>(movie);
}

$update;
export function updateMovie(id: string, payload: MoviePayload): Result<Movie, string> {
    const result = getUserByPrincipal();
    if (result.Err || !result.Ok) {
        return Result.Err(result.Err);
    }
    return match(movieStorage.get(id), {
        Some: (movie) => {

            const newMovie = { ...movie, ...payload, updateAt: Opt.Some(ic.time()) };
            movieStorage.insert(id, newMovie);
            return Result.Ok<Movie, string>(movie);
        },
        None: () => Result.Err<Movie, string>(`A movie with id=${id} not found`)
    })
}

$update;
export function deleteMovie(id: string): Result<Movie, string> {

    const result = getUserByPrincipal();
    if (result.Err || !result.Ok) {
        return Result.Err(result.Err);
    }
    return match(movieStorage.remove(id), {
        Some: (deletedMovie) => {
            return Result.Ok<Movie, string>(deletedMovie);
        },
        None: () => Result.Err<Movie, string>(`A movie with id=${id} not found`)
    })
}




////////////////////////////////////////////////////////////////
// Watchlists operations
////////////////////////////////////////////////////////////////
$query;
export function getWatchlist(): Result<WatchList, string> {
    const result = getUserByPrincipal();
    if (result.Err || !result.Ok) {
        return Result.Err<WatchList, string>(result.Err);
    }
    const currentUser : User = result.Ok;
    return match(userWatchlistStorage.get(currentUser.principal), {
        Some: (watchlist) => Result.Ok<WatchList, string>(watchlist),
        None: () => Result.Err<WatchList, string>(`A watchlist for user with principal=${currentUser.principal} not found`)
    })
}

$update;
export function addMovieToWatchlist(movieId: string): Result<string, string> {
    const result = getUserByPrincipal();
    if (result.Err || !result.Ok) {
        return Result.Err<string, string>(result.Err);
    }
    const currentUser : User = result.Ok;

    if (!movieStorage.get(movieId).Some) {
        return Result.Err<string, string>(`A movie with id=${movieId} not found`);
    }

    return match(userWatchlistStorage.get(currentUser.principal), {
        Some: (watchlist) => {
            if (watchlist.movies.includes(movieId)) {
                return Result.Ok<string, string>(`Movie with id=${movieId} is already in the watchlist`);
            }

            watchlist.movies.push(movieId);
            userWatchlistStorage.insert(currentUser.principal, watchlist);
            return Result.Ok<string, string>(`Successfully added movie with id=${movieId} to watchlist`);
        },
        None: () => Result.Ok<string, string>(``)
    })
}

$update;
export function removeMovieFromWatchlist(movieId: string): Result<string, string> {
    const result = getUserByPrincipal();
    if (result.Err || !result.Ok) {
        return Result.Err<string, string>(result.Err);
    }
    const currentUser : User = result.Ok;

    if (!movieStorage.get(movieId).Some) {
        return Result.Err<string, string>(`A movie with id=${movieId} not found`);
    }

    return match(userWatchlistStorage.get(currentUser.principal), {
        Some: (watchlist) => {
            if (!watchlist.movies.includes(movieId)) {
                return Result.Ok<string, string>(`Movie with id=${movieId} is not in the watchlist`);
            }

            watchlist.movies = watchlist.movies.filter(id => id !== movieId);
            userWatchlistStorage.insert(currentUser.principal, watchlist);
            return Result.Ok<string, string>(`Successfully removed movie with id=${movieId} from watchlist`);
        },
        None: () => Result.Ok<string, string>(``)
    })
}


globalThis.crypto = {
    // @ts-ignore
    getRandomValues: () => {
        let array = new Uint8Array(32)

        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256)
        }

        return array
    }
}
