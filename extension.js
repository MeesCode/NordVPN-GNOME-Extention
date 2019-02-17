const Lang = imports.lang;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Soup = imports.gi.Soup;
const Mainloop = imports.mainloop;
const Util = imports.misc.util;

const API_URL = 'https://nordvpn.com/wp-admin/admin-ajax.php';

const NordVPN = new Lang.Class({
    Name: "NordVPN status",
    Extends: PanelMenu.Button,

    _init: function () {
        this.parent(null, "NordVPN status");

        // Icon
        this.icon = new St.Icon({
            style_class: "nordvpn system-status-icon connected"
        });
        this.actor.add_actor(this.icon);

    },

    _refresh: function () {
        log('Refreshing');
        this._getStatus();
        this._removeTimeout();
        this._timeout = Mainloop.timeout_add_seconds(30, Lang.bind(this, this._refresh));
        return true;
    },

    _removeTimeout: function () {
        if (this._timeout) {
            Mainloop.source_remove(this._timeout);
            this._timeout = null;
        }
    },

    _getStatus: function () {
        _httpSession = new Soup.Session();

        let params = {
            action: 'get_user_info_data'
        };

        let message = Soup.form_request_new_from_hash('GET', API_URL, params);
        _httpSession.queue_message(message, Lang.bind(this,
            function (_httpSession, message) {
                //remove old menu entries
                this.menu.removeAll();

                if (message.status_code !== 200) {
                    log('http request failed; status:' + message.status_code);

                    // icon
                    this.icon.style_class = 'nordvpn system-status-icon disconnected';

                    // status
                    this.ipItem = new PopupMenu.PopupMenuItem('no connection info', {});
                    this.menu.addMenuItem(this.ipItem);
                    return;
                }

                let data = JSON.parse(message.response_body.data);
                if (data.status) {
                    // icon
                    this.icon.style_class = 'nordvpn system-status-icon connected';

                    // ip
                    this.ipItem = new PopupMenu.PopupMenuItem(data.ip, {});
                    this.menu.addMenuItem(this.ipItem);

                    // location
                    this.locationItem = new PopupMenu.PopupMenuItem(data.location, {});
                    this.menu.addMenuItem(this.locationItem);

                    this.connectItem = new PopupMenu.PopupSwitchMenuItem('connection', true);
                    this.menu.addMenuItem(this.connectItem);

                    this.connectItem.connect('toggled', Lang.bind(this, function (object, value) {
                        if (value) {
                            Main.Util.trySpawnCommandLine('nordvpn c');
                        } else {
                            Main.Util.trySpawnCommandLine('nordvpn d');
                        }

                    }));

                    // disconnect button
                    // this.menu.addAction("disconnect", function (event) {
                    //     Main.Util.trySpawnCommandLine('nordvpn d');
                    //     this._refresh();
                    // });

                } else {
                    //icon
                    this.icon.style_class = 'nordvpn system-status-icon disconnected';

                    this.connectItem = new PopupMenu.PopupSwitchMenuItem('connection', false);
                    this.menu.addMenuItem(this.connectItem);

                    this.connectItem.connect('toggled', Lang.bind(this, function (object, value) {
                        if (value) {
                            Main.Util.trySpawnCommandLine('nordvpn c');
                        } else {
                            Main.Util.trySpawnCommandLine('nordvpn d');
                        }

                    }));

                    // connect button
                    // this.menu.addAction("connect", function (event) {
                    //     Main.Util.trySpawnCommandLine('nordvpn c');
                    //     this._refresh();
                    // });
                }
            })
        );
    }

});

function init() {
}

function enable() {
    let indicator = new NordVPN();
    indicator._refresh();
    Main.panel.addToStatusArea("nordvpn-status", indicator);
}

function disable() {
    // you could also track "indicator" and just call indicator.destroy()
    Main.panel.statusArea["nordvpn-status"].destroy();
}