'use strict';

var Funneler = require('./lib/main.js');

var sites = new Funneler([
    {
        client_id: 1,
        page: 1,
        results_per_page: 2,
    },
    {
        $map() {
            this.emit(1);
            this.emit(2);
            this.emit(3);
            this.emit(3);
        },
    },
    {
        $reduce(id) {
            if (id != 3 && id != 2) {
                this.getStorage().remove(id);
            }
        }
    },
    {
        $batchReduce: [ 25, function(ids) {
            ids.forEach(id => {
                if (id == 2) {
                    this.getStorage().remove(id);
                }
            });
        } ],

        $reduce(id) {
            return new Promise((resolve, reject) => {
                if (id < 2) {
                    this.getStorage().remove(id);
                }
                resolve();
            });
        }
    },
    {
        $sortData: [ 25, function(items) {
            return new Promise((resolve, reject) => {
                items.forEach(item => {
                    this.getStorage().data(item._id, 'title', 'index_' + item._id);
                });
                resolve();
            });
        } ],

        $sort(a, b) {
            return a.title < b.title;
        }
    },
    {
        $slice() {
            let limit = this.getConfig('results_per_page'),
                page = this.getConfig('page'),
                offset = (page - 1) * limit;

            return this.getStorage().slice.apply(this.getStorage(), [offset, limit]);
        },

        $data(id) {
            return new Promise((resolve, reject) => {
                if (id == 2) {
                    this.getStorage().data(id, 'is first', true);
                }

                resolve();
            });
        },

/*
        $batchData: [ 25, function(ids) {
            let promises = [];

            ids.forEach(id => {
                promises.push(this.getStorage().extend(id, {
                    title2: 'title' + id,
                    viewed: true
                }));
            });

            return Promise.all(promises);
        } ]
        */
    }
]);

sites.exec().then(ids => {
    console.log('Success:', ids);
}).catch(err => {
    console.error('Failure:', err);
});
