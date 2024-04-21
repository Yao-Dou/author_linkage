const app = Vue.createApp({
    data() {
        return {
            current_hit: 0,
            hits_data: {},

            bookmarked: false,
            linkage: -100,
            comment: "",
        }
    },
    methods: {
        cacheAnnotations() {
            // Initialize the annotations dictionary if it doesn't exist
            if (!this.hits_data[this.current_hit].annotations) {
                this.hits_data[this.current_hit].annotations = {
                            linkage: -100,
                            comment: "",
                        };
            }

            let urlParams = new URLSearchParams(window.location.search);
            let data_path = urlParams.get('data');
            let annotator_name = urlParams.get('name')

            localStorage.setItem(`linkage_data_${annotator_name}_${data_path}`, JSON.stringify(this.hits_data));
        },
        go_to_hit(hit_num) {
            if (hit_num > this.total_hits - 1) {
                hit_num = this.total_hits - 1;
            } else if (hit_num < 0) {
                hit_num = 0;
            }
            this.current_hit = hit_num;

            // Load annotations for the current hit
            const annotations = this.hits_data[this.current_hit].annotations;

            this.bookmarked = annotations.linkage == -1;
            this.linkage = (annotations.linkage !== undefined && annotations.linkage !== null) ? annotations.linkage : -100;
            this.comment = annotations.comment || "";
        },
        go_to_hit_circle(hit_num, event) {
            this.go_to_hit(hit_num);
        },
        refreshVariables() {
            this.current_hit = 0;
    
            const annotations = this.hits_data[this.current_hit].annotations || {};
            this.bookmarked = annotations.linkage == -1;
            this.linkage = (annotations.linkage !== undefined && annotations.linkage !== null) ? annotations.linkage : -100;
            this.comment = annotations.comment || "";
        },
        handle_file_upload(event) {
            const file = event.target.files[0];
            if (file && file.type === "application/json") {
                const reader = new FileReader();
                reader.readAsText(file);
                reader.onload = (e) => {
                    try {
                        const jsonData = JSON.parse(e.target.result);
                        // You can do further validations here, if needed
                        this.hits_data = jsonData;

                        for (const hit of this.hits_data) {
                            if (hit.annotations === undefined) {
                                hit.annotations = {
                                    linkage: -100,
                                    comment: "",
                                }
                            }
                        }
        
                        let urlParams = new URLSearchParams(window.location.search);
                        let data_path = urlParams.get('data');
                        let annotator_name = urlParams.get('name')
        
                        // Reset the cache with the new hits_data
                        localStorage.setItem(`linkage_data_${annotator_name}_${data_path}`, JSON.stringify(this.hits_data));
                        
                        this.refreshVariables();  // Refresh other variables
                    } catch (error) {
                        alert('Invalid JSON file.');
                    }
                };
            } else {
                alert('Please upload a JSON file.');
            }
        },          
        handle_file_download() {
            let urlParams = new URLSearchParams(window.location.search);
            let data_path = urlParams.get('data');
            let annotator_name = urlParams.get('name')

            // remove .json
            const filename = `${annotator_name}_${data_path}_linkage_annotations.json`;
            
            const blob = new Blob([JSON.stringify(this.hits_data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
    
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        },
        circleClass(hit_num) {
            const annotations = this.hits_data[hit_num]?.annotations || {};
            let classes = [];
            if (hit_num === this.current_hit) {
                classes.push('black-border');
            }
            if (annotations.linkage == -1) {
                classes.push('bg-red');
            } else if (annotations.linkage == -2) {
                classes.push('bg-yellow');
            } else if (annotations.linkage != -100) {
                classes.push('bg-green');
            }
            return classes.join(' ');
        },
        refreshTwitterTimelines() {
            // Get the current hit's wiki search results
            const results = this.hits_data[this.current_hit]?.wiki_search_results;
            if (results) {
                results.forEach((result, index) => {
                    if (result.x_handle) {
                        this.loadTwitterTimeline(index, result.x_handle);
                    }
                });
            }
        },
        loadTwitterTimeline(index, handle) {
            this.$nextTick(() => {
                const container = this.$refs[`twitterTimelineContainer${index}`];
                if (!container) {
                    return;
                }

                container.innerHTML = "";

                const anchor = document.createElement("a");
                anchor.setAttribute("class", "twitter-timeline");
                anchor.setAttribute("data-lang", "en");
                anchor.setAttribute("data-theme", "light");
                anchor.setAttribute("data-height", "300");
                anchor.setAttribute("href", `https://twitter.com/${handle}`);
                container.appendChild(anchor);

                if (window.twttr && window.twttr.widgets) {
                    window.twttr.widgets.load(container);
                } else {
                    const script = document.createElement("script");
                    script.setAttribute("src", "https://platform.twitter.com/widgets.js");
                    script.setAttribute("charset", "utf-8");
                    script.async = true;
                    document.body.appendChild(script);
                }
            });
        },
        googleSearchUrl(domain) {
            const authors = this.author_str.replace(/ /g, '+');
            return `https://www.google.com/search?q=${authors}+${domain}`;
        },
        selectLinkage(index) {
            this.linkage = index;  // Update the selected index
        }
    },
    watch: {
        linkage: function(newlinkage) {
            if (this.hits_data[this.current_hit]?.annotations) {
                this.hits_data[this.current_hit].annotations.linkage = Number(newlinkage);
            }
            if (newlinkage != -2) {
                this.comment = ''; // Reset comment when it's not the "Unsure" option.
            }
        },
        hits_data: {
            deep: true,
            handler() {
                this.cacheAnnotations();
            }
        },
        current_hit(newHit, oldHit) {
            // React to changes in current_hit to reload Twitter timelines
            this.refreshTwitterTimelines();
        },
        comment(newComment, oldComment) {
            if (this.hits_data[this.current_hit]?.annotations) {
                this.hits_data[this.current_hit].annotations.comment = newComment;
            }
        }
    },
    created: function () {
        let urlParams = new URLSearchParams(window.location.search);
        let data_path = urlParams.get('data');
        let annotator_name = urlParams.get('name')

        // Try loading linkage from localStorage first
        let cachedData = localStorage.getItem(`linkage_data_${annotator_name}_${data_path}`);
        if (cachedData) {
            this.hits_data = JSON.parse(cachedData);
            this.refreshVariables();
            return;
        }

        fetch(`https://raw.githubusercontent.com/Yao-Dou/author_linkage/main/data/${annotator_name}/${data_path}.json`)
            .then(r => r.json())
            .then(json => {
                this.hits_data = json
                
                for (const hit of this.hits_data) {
                    if (hit.annotations === undefined) {
                        hit.annotations = {
                            linkage: -100,
                            comment: "",
                        }
                    }
                }

                localStorage.setItem(`linkage_data_${annotator_name}_${data_path}`, JSON.stringify(this.hits_data));
                this.refreshVariables(); // Refresh other variables
            });
    },
    mounted() {
        // this.loadTwitterTimeline();

        // Load Twitter timelines for all current search results
        if (this.hits_data[this.current_hit] && this.hits_data[this.current_hit].wiki_search_results) {
            this.hits_data[this.current_hit].wiki_search_results.forEach((result, index) => {
                if (result.x_handle) {
                    this.loadTwitterTimeline(index, result.x_handle);
                }
            });
        }

        this.keypressHandler = (event) => {
            switch (event.key) {
                case 'ArrowLeft':
                    this.go_to_hit(this.current_hit - 1);
                    break;
                case 'ArrowRight':
                    this.go_to_hit(this.current_hit + 1);
                    break;
            }
        };
        window.addEventListener('keydown', this.keypressHandler);
    },
    beforeDestroy() {
        window.removeEventListener('keydown', this.keypressHandler);
    },
    computed: {
        isCurrentHitBookmarked() {
            return this.hits_data[this.current_hit]?.annotations?.linkage == -1;
        },
        total_hits() {
            return this.hits_data.length;
        },
        author_str() {
            if (!this.hits_data[this.current_hit]) {
                return "" // or return whatever makes sense in your context
            }
            return this.hits_data[this.current_hit].author_str;
        },
        article_urls() {
            if (!this.hits_data[this.current_hit]) {
                return [] // or return whatever makes sense in your context
            }
            return this.hits_data[this.current_hit].article_urls;
        },
        article_domains() {
            if (!this.hits_data[this.current_hit]) {
                return []; // Return an empty array if there is no current hit data
            }
            const urls = this.hits_data[this.current_hit].article_urls;
            const domains = urls.map(url => {
                try {
                    const hostname = new URL(url).hostname; // Extracts the domain from the URL
                    return hostname;
                } catch (error) {
                    console.error("Invalid URL:", url); // Handle possible invalid URLs gracefully
                    return null;
                }
            });
            return [...new Set(domains.filter(domain => domain != null))]; // Filters out null and removes duplicates
        },
        twitter_username() {
            if (!this.hits_data[this.current_hit]) {
                return ''; // or return whatever makes sense in your context
            }
            return this.hits_data[this.current_hit].twitter_username;
        },
        twitterTimelineUrl() {
            const username = this.twitter_username;
            return `https://twitter.com/${username}?ref_src=twsrc%5Etfw`;
        },
        wikipedia_url() {
            if (!this.hits_data[this.current_hit]) {
                return 'https://en.wikipedia.org/wiki/'; // Fallback URL
            }

            const wikipedia_title = this.hits_data[this.current_hit].wikipedia_title;
            //  if wikipedia_title is "" then return the fallback URL
            if (wikipedia_title === "") {
                return 'https://en.wikipedia.org/wiki/';
            }
            const formattedTitle = wikipedia_title.replace(/ /g, '_');
            return `https://en.wikipedia.org/wiki/${formattedTitle}`;
        },
    },
})


app.mount('#app')
