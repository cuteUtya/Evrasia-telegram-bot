class EvrasiaApi {
    static Login(login: String, password: String): Cookies {
        return [];
    }

    static Logout(user: Cookies) {

    }

    static GetCode(user: Cookies): number {
        return -1;
    }

    static GetCards(user: Cookies) {

    }

    static GetBalance(user: Cookies): number {
        return -1;
    }

    static ActivateCode(user: Cookies, restaurantIndex: number/* and card index, but idk, looks like it removed*/): number {
        return -1;
    }

    static GetAdresess(user: Cookies): Array<RestaurantAdress> {
        return [];
    }
}

interface RestaurantAdress {
    name: String;
    index: number;
}