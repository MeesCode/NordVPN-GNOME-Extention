const Lang = imports.lang;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Soup = imports.gi.Soup;
const Mainloop = imports.mainloop;

const API_URL = 'https://nordvpn.com/wp-admin/admin-ajax.php';

const TimeButton = new Lang.Class({
    Name: "TimeButton status",
    Extends: PanelMenu.Button,

    _init: function () {
        this.parent(null, "TimeButton status");

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
                //remove old menu entreis


                if (message.status_code !== 200) {
                    log('http request failed; status:' + message.status_code);
                    this.icon.style_class = 'nordvpn system-status-icon disconnected';
                    // status
                    this.ipItem = new PopupMenu.PopupMenuItem('no connection info', {});
                    this.menu.addMenuItem(this.ipItem);
                    return;
                }
                let data = JSON.parse(message.response_body.data);
                log('data parsed');
                if (data.status) {
                    this.icon.style_class = 'nordvpn system-status-icon connected';

                    // status
                    this.statusItem = new PopupMenu.PopupMenuItem('connected', {});
                    this.menu.addMenuItem(this.statusItem);

                    // ip
                    this.ipItem = new PopupMenu.PopupMenuItem(data.ip, {});
                    this.menu.addMenuItem(this.ipItem);

                    // location
                    this.locationItem = new PopupMenu.PopupMenuItem(data.location, {});
                    this.menu.addMenuItem(this.locationItem);
                } else {
                    this.icon.style_class = 'nordvpn system-status-icon disconnected';
                    // status
                    this.statusItem = new PopupMenu.PopupMenuItem('not connected', {});
                    this.menu.addMenuItem(this.statusItem);
                }
            })
        );
    }

});

function init() {
}

function enable() {
    let indicator = new TimeButton();
    indicator._refresh();
    Main.panel.addToStatusArea("this-is-test", indicator);
}

function disable() {
    // you could also track "indicator" and just call indicator.destroy()
    Main.panel.statusArea["this-is-test"].destroy();
}