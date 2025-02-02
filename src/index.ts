import { $query, $update, Record, StableBTreeMap, Vec, match, Result, nat64, ic, Opt } from 'azle';
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
}>;

type MoviePayload = Record<{
    title: string,
    description: string,
    genre: string,
    imageURL: string,
    coverImageURL: string,
}>;

type User = Record<{
    id: string,
    name: string,
    email: string,
    password: string,
    createdAt: nat64,
    updateAt: Opt<nat64>,
}>;

type UserPayload = Record<{
    name: string,
    email: string,
    password: string,
}>;

type WatchList = Record<{
    id: string,
    movies: Vec<string>,
}>;

export const movieStorage = new StableBTreeMap<string, Movie>(0, 44, 1024);
const userStorage = new StableBTreeMap<string, User>(1, 44, 1024);
const userWatchlistStorage = new StableBTreeMap<string, WatchList>(2, 44, 2048);

let currentUser: User | null = null;


////////////////////////////////////////////////////////////////
// User operations
////////////////////////////////////////////////////////////////

function getUserByEmail(email: string): User | null {
    return userStorage.values().filter(user => user.email === email)[0];
}

$update;
export function createUser(payload: UserPayload): Result<string, string> {
    const user = getUserByEmail(payload.email);
    if (user) {
        return Result.Err<string, string>(`A user with email=${payload.email} already exists!`);
    }

    const newUser: User = { id: uuidv4(), createdAt: ic.time(), updateAt: Opt.None, ...payload };
    userStorage.insert(newUser.id, newUser);

    userWatchlistStorage.insert(newUser.id, { id: uuidv4(), movies: [] });
    return Result.Ok<string, string>(`A user with email=${payload.email} successfully created!`);
}

$update;
export function loginUser(email: string, password: string): Result<string, string> {
    const user = getUserByEmail(email);
    if (!user) {
        return Result.Err<string, string>(`A user with email=${email} does not exist!`);
    }

    if (user.password !== password) {
        return Result.Err<string, string>(`Wrong password!`);
    }

    currentUser = user;
    return Result.Ok(`Successfully logged in!`);
}

export function logoutUser(): Result<string, string> {
    if (!currentUser) {
        return Result.Err<string, string>(`No user is logged in!`);
    }

    currentUser = null;
    return Result.Ok<string, string>(`Successfully logged out!`);
}

////////////////////////////////////////////////////////////////
// Movies operations
////////////////////////////////////////////////////////////////
$query;
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
    const filteredMovies = movieStorage.values().filter(movie => movie.title === title);
    if (filteredMovies.length === 0) {
        return Result.Err<Movie, string>(`A movie with title=${title} not found`);
    }
    return Result.Ok<Movie, string>(filteredMovies[0]);
}

$update;
export function createMovie(payload: MoviePayload): Result<Movie, string> {
    const movie: Movie = { id: uuidv4(), createdAt: ic.time(), updateAt: Opt.None, ...payload };
    movieStorage.insert(movie.id, movie);
    return Result.Ok<Movie, string>(movie);
}

$update;
export function updateMovie(id: string, payload: MoviePayload): Result<Movie, string> {
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
    return match(movieStorage.remove(id), {
        Some: (deletedMovie) => {
            deleteMovieFromWatchlists(id);
            return Result.Ok<Movie, string>(deletedMovie);
        },
        None: () => Result.Err<Movie, string>(`A movie with id=${id} not found`)
    })
}

function deleteMovieFromWatchlists(id: string): void {
    userWatchlistStorage.values().forEach(watchlist => {
        watchlist.movies = watchlist.movies.filter(movieId => movieId !== id);
        userWatchlistStorage.insert(watchlist.id, watchlist);
    })
}

////////////////////////////////////////////////////////////////
// Watchlists operations
////////////////////////////////////////////////////////////////
$query;
export function getWatchlist(): Result<WatchList, string> {
    if (!currentUser) {
        return Result.Err<WatchList, string>(`No user is logged in!`);
    }
    return match(userWatchlistStorage.get(currentUser.id), {
        Some: (watchlist) => Result.Ok<WatchList, string>(watchlist),
        None: () => Result.Err<WatchList, string>(`A watchlist for user with id=${currentUser?.id} not found`)
    })
}

$update;
export function addMovieToWatchlist(movieId: string): Result<string, string> {
    if (!currentUser) {
        return Result.Err<string, string>(`No user is logged in!`);
    }

    if (!movieStorage.get(movieId)) {
        return Result.Err<string, string>(`A movie with id=${movieId} not found`);
    }

    return match(userWatchlistStorage.get(currentUser.id), {
        Some: (watchlist) => {
            if (watchlist.movies.includes(movieId)) {
                return Result.Ok<string, string>(`Movie with id=${movieId} is already in the watchlist`);
            }

            watchlist.movies.push(movieId);
            userWatchlistStorage.insert(currentUser!.id, watchlist);
            return Result.Ok<string, string>(`Successfully added movie with id=${movieId} to watchlist`);
        },
        None: () => Result.Ok<string, string>(``)
    })
}

$update;
export function removeMovieFromWatchlist(movieId: string): Result<string, string> {
    if (!currentUser) {
        return Result.Err<string, string>(`No user is logged in!`);
    }

    if (!movieStorage.get(movieId)) {
        return Result.Err<string, string>(`A movie with id=${movieId} not found`);
    }

    return match(userWatchlistStorage.get(currentUser.id), {
        Some: (watchlist) => {
            if (!watchlist.movies.includes(movieId)) {
                return Result.Ok<string, string>(`Movie with id=${movieId} is not in the watchlist`);
            }

            watchlist.movies = watchlist.movies.filter(id => id !== movieId);
            userWatchlistStorage.insert(currentUser!.id, watchlist);
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