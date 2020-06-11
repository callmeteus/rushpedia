(function() {
    /**
     * Game handler
     * @var object
     */
    const game = {
        from: null,
        to: null,
        current: null,
        is_loading: true,
        start_time: 0,
        loading_time: 0,
        visited_pages: [],
        timer: null,
        started: false
    };

    /**
     * Converts milliseconds to hours, minutes, seconds and milliseconds
     * @param number duration The milliseconds to convert
     */
    function msToTime(duration) {
        var milliseconds = parseInt((duration % 1000) / 100),
        seconds = Math.floor((duration / 1000) % 60),
        minutes = Math.floor((duration / (1000 * 60)) % 60),
        hours = Math.floor((duration / (1000 * 60 * 60)) % 24);
    
        hours = (hours < 10) ? "0" + hours : hours;
        minutes = (minutes < 10) ? "0" + minutes : minutes;
        seconds = (seconds < 10) ? "0" + seconds : seconds;
    
        return hours + ":" + minutes + ":" + seconds + "." + milliseconds;
    }

    /**
     * Do a single request to the Wikipedia API
     * @param string url The URL to be request
     */
    function wikipedia_request(url) {
        return new Promise((resolve, reject) => {
            $.ajax({
                url: url + "&origin=*&format=json",
                method: "GET",
                crossDomain: true,
                dataType: "json"
            })
            .done((data) => resolve(data))
            .fail(reject);
        });
    }

    /**
     * Get a single Wikipedia page information
     * @param string page The page title
     * @param string base The MediaWiki base URL (defaults to en.wikipedia.org)
     */
    function wikipedia_get_page(page, base = "en.wikipedia.org") {
        return wikipedia_request("https://" + base + "/w/api.php?action=parse&page=" + page)
        .then((data) => {
            return data.parse;
        });
    }

    /**
     * Go to a Wikipedia page
     * @param string page Page name
     */
    function wikipedia_go_to(page) {
        // Parse the page URL
        const url = new URL(page);

        // Check if reached the end
        if (url.pathname === game.to.pathname) {
            // Stop the timer
            clearInterval(game.timer);

            // Add end class to the game
            $("#game").addClass("end");

            // Set the sharer data
            addthis_share.title = "I've made " + msToTime(game.current_time) + " on Rushpedia!";
            addthis_share.description = "Going from " + game.start_page.title + " to " + game.end_page.title;

            return;
        }

        // Get the page name
        page = url.pathname.replace("/wiki/", "");

        // Set current page URL
        $("#game .address").val(url);

        game.is_loading = true;
        const loading_start = Date.now();

        // Show the preloader
        $("#game .preloader").show();

        return wikipedia_get_page(page, url.host)
        .then((data) => {
            // Get the last visited page
            const last_page = game.visited_pages[game.visited_pages.length - 1];

            // Add the page to the visited pages
            game.visited_pages.push({
                id: data.pageid,
                title: data.title,
                time: Date.now()
            });

            // Set page URL
            data.url = url;

            // Set page time
            data.time = Date.now();

            // Set current page
            game.current = data;

            // Set page contents
            $("#game .content .page").html(data.text["*"]);

            // Get the loading duration
            const duration = Date.now() - loading_start;

            // Add it to the total loading time
            game.loading_time += duration;

            // Set to not loading
            game.is_loading = false;

            // Hide the preloader
            $("#game .preloader").hide();

            let time_diff = last_page ? (Date.now() - last_page.time) : 0;

            // Add it to the visited pages
            $("#game #visited-pages").append(`
                <div class="list-group-item">
                    <a href="${data.url}" class="text-muted">
                        <strong>${data.title}</strong>
                    </a> <span class="text-info">+${msToTime(time_diff)}</span>
                </div>
            `);
        });
    }

    // On click the randomize button
    $(".btn-randomize").on("click", (e) => {
        e.preventDefault();

        const $el = $(e.target);
        const $parent = $el.parents(".input-group");
        const $input = $parent.find("input");

        $el.prop("disabled", true);

        const base = "en.wikipedia.org";

        wikipedia_request("https://" + base + "/w/api.php?action=query&generator=random&grnnamespace=0&grnlimit=1&prop=info")
        .then((data) => {
            // Get the first found page
            const page = Object.values(data.query.pages)[0];

            // Get the title
            const title = page.title;

            // Get the page URL
            const url = new URL("/wiki/" + title.replace(/ /g, "_"), "https://" + base);

            // Set the input value
            $input.val(url);

            // Re-enable the button
            $el.prop("disabled", false);
        })
    });

    // On submit the start game form
    $("#menu form").on("submit", (e) => {
        e.preventDefault();

        // Set from and to
        game.from = new URL($("#menu #from").val());
        game.to = new URL($("#menu #to").val());

        // Set the start time
        game.start_time = Date.now() + 4000;

        // Set game status to not started
        game.started = false;

        // Hide the menu
        $("#menu").hide();

        // Show the game screen
        $("#game").removeClass("end").show();

        // Clear the game contents
        $("#game .content .page, #game .content #visited-pages, .game .content .sidebar").html(null);

        // Show the countdown
        $("#game .countdown").show();

        // Start the timer
        game.timer = setInterval(() => {
            // Get current time
            const now = Date.now();

            // Check if it's a countdown
            if (!game.started) {
                // Get the time diff
                const diff = now - game.start_time;

                // Check if the countdown has ended
                if (diff > 0) {
                    // Set game status to started
                    game.started = true;

                    // Hide the countdown
                    $("#game .countdown").hide();

                    // Show the game container
                    $("#game .content .page, #game .content .sidebar").show();

                    // Load the first page
                    wikipedia_go_to(game.from);
                } else {
                    // Update the countdown
                    $("#game .countdown .timer").html("<small class=\"d-block\">Game starts in...</small>" + Math.abs(Math.floor(diff) / 1000));
                }

                return;
            }

            // Check if is loading
            if (game.is_loading) {
                return;
            }

            // Get the time difference
            game.current_time = now - game.start_time - (game.loading_time);

            // Set the timer
            $("#game .game-timer").text(msToTime(game.current_time));
        }, 30);
    });

    // On click any game link
    $("#game .content .page").on("click", "a", (e) => {    
        // Parse the URL
        const url = new URL(e.target.href);

        // Check if it's not a Wikipedia URL
        if (url.hostname !== window.location.hostname) {
            e.preventDefault();
            $(e.target).addClass("text-danger").append("<small class=\"ml-1\">(external links are not supported)</small>");
            return false;
        }

        // Check if it has a hash
        if (url.hash.length > 0 && url.pathname.indexOf("/wiki/") === -1) {
            // Permit the navigation
            return true;
        }

        e.preventDefault();

        // Go to this page
        wikipedia_go_to(url.href.replace(window.location.host, game.current.url.host));
    });

    // On click the play again button
    $("#game .content .sidebar .btn-play-again").on("click", (e) => {
        e.preventDefault();
        $("#game").hide();
        $("#menu").show();
    });
}());