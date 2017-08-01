var VideoRoom = function(endpoint) {
  var self = this;

  this.my_id = null;
  this.my_private_id = null;
  this.my_room = null;
  this.my_stream = null;

  var peer = {};
  peer.sub = {};
  var session = null;
  var handler = null;
  var username = null;
  var websocket = null;
  var transactions = [];

  websocket = new WebSocket(endpoint, "janus-protocol");

  websocket.onopen = function(evt) {
    createSession(function(error, result) {
      if (error) {
        self.onError(error);
        return;
      }

      session = result.session;

      createHandler(session, function(error, result) {
        if (error) {
          self.onError(error);
          return;
        }

        handler = result.handler;
        self.onReady();
      });
    });
  };

  websocket.onmessage = function(evt) {
    var json = JSON.parse(evt.data);
    var event = json.janus;
    var transaction = json.transaction;

    if (transaction) {
      var response = transactions[transaction];

      if (response) {
        response(json);
      }

      return;
    }

    if (!json.sender) {
      return;
    }

    if (event == "webrtcup") {
      self.onEvent("webrtc", { status: "up", feed: json.sender });
    } else if (event == "hangup") {
      self.onEvent("webrtc", { status: "down", feed: json.sender });
    } else if (event == "slowlink") {
      var uplink = json.uplink;
      var nacks = json.nacks;

      if (nacks < 10) {
        return;
      }

      self.onEvent("losses", {
        direction: uplink ? "outgoing" : "incoming",
        feed: json.sender,
        nacks: nacks
      });
    } else if (json.plugindata && json.plugindata.data) {
      if (json.plugindata.data.publishers) {
        var publishers = json.plugindata.data.publishers;

        for (var i in publishers) {

          self.onEvent("publisher", { event: "new", publisher: publishers[i] })
        }

        return;
      } else if (json.plugindata.data.unpublished) {
        var publisher = json.plugindata.data.unpublished;

        self.onEvent("publisher", { event: "left", publisher: publisher })

        return;
      } else {
        //console.log(json)
      }
    } else {
      //console.warn('Unhandled event:', json);
    }
  };
  websocket.onclose = function(evt) {
    websocket = null;
  };
  websocket.onerror = function(evt) {
    
  };

  //- Private Method

  function createSession(callback) {
    var payload = {
      janus: "create"
    };

    send(payload, function(response) {
      delete transactions[response.transaction];

      if (response.janus == "error") {
        return callback({ error: response.error.reason });
      }

      return callback(null, { session: response.data.id });
    });
  }

  function createHandler(session, callback) {
    var payload = {
      janus: "attach",
      plugin: "janus.plugin.videoroom",
      session_id: session
    };

    send(payload, function(response) {
      delete transactions[response.transaction];

      if (!response.data || !response.data.id) {
        return callback({ error: "Error creating plugin handler" });
      }

      keepAlive(session);

      return callback(null, { handler: response.data.id });
    });
  }

  function captureLocalVideo() {
    navigator.getUserMedia({
      video: true,
      audio: true
    }, function(stream) {
      self.my_stream = stream;
      self.onLocalStream(stream);
    }, function(error) {
      self.onError(error);
    });
  }

  function keepAlive(session) {
    var keepalive = setInterval(function() {
      if (!websocket) {
        clearInterval(keepalive);
        return;
      }

      var payload = {
        janus: "keepalive",
        session_id: session
      };

      send(payload, function(response) {
        delete transactions[response.transaction];
      });
    }, 4500);
  }

  function trickle(handle_id, candidate) {
    var payload = {
      janus: "trickle",
      session_id: session,
      handle_id: handle_id,
      candidate: candidate
    };

    send(payload, function(response) {
      delete transactions[response.transaction];
    });
  };

  function send(request, callback) {
    var transaction = randomString();

    if (callback) {
      transactions[transaction] = callback;
    }

    request.transaction = transaction;

    websocket.send(JSON.stringify(request));
  }

  function randomString() {
    var charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var randomstring = '';

    for (var i = 0; i < 16; i++) {
      var randompos = Math.floor(Math.random() * charset.length);
      randomstring += charset.substring(randompos, randompos+1);
    }

    return randomstring;
  }

  //- End Private Method

  //- Public Method

  this.createRoom = function(room) {
    var body = {
      request: "create",
      room: parseInt(room),
      description: "Room " + room,
      publishers: 4,
      fir_freq: 10,
      bitrate: 128000,
      secret: "rahasia",
      record: false
    };
    var payload = {
      janus: "message",
      session_id: session,
      handle_id: handler,
      body: body
    };

    send(payload, function(response) {
      delete transactions[response.transaction];

      if (response.janus == "error") {
        self.onError(response.error.reason);
        return;
      }

      var data = response.plugindata.data;

      if (data.error) {
        self.onError(data.error);
        return;
      }

      self.joinRoom(room);
      return;
    });
  };

  this.joinRoom = function(room) {
    var body = {
      request: "join",
      ptype: "publisher",
      room: parseInt(room),
      display: ""
    };
    var payload = {
      janus: "message",
      session_id: session,
      handle_id: handler,
      body: body
    };

    send(payload, function(response) {
      var event = response.janus;

      if (event == "error") {
        delete transactions[response.transaction];
        self.onError(response.error.reason);
        return;
      }

      if (event == "ack") {
        return;
      }

      var data = response.plugindata.data;

      if (data.error) {
        delete transactions[response.transaction];
        self.onError(data.error);
        return;
      }

      if (data.reason) {
        delete transactions[response.transaction];
        self.onError(data.error);
        return;
      } else {
        delete transactions[response.transaction];

        self.my_room = parseInt(room);
        var newPublishers = [];

        if (data.publishers) {
          newPublishers = data.publishers;
        }

        self.my_id = data.id;
        self.my_private_id = data.private_id;

        captureLocalVideo();

        self.onJoinRoom({ room: self.my_room, publishers: newPublishers });
        return;
      }
    });
  };

  this.publish = function(username) {
    peer.pub = {};
    peer.pub.pc = new SimplePeer({
      initiator: true,
      stream: self.my_stream,
      constraints: {
        optional: [{ DtlsSrtpKeyAgreement: true }]
      },
      offerConstraints: {
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      },
      answerConstraints: {
        mandatory: {
          OfferToReceiveAudio: true,
          OfferToReceiveVideo: true
        }
      }
    });
    peer.pub.pc.on("signal", function(jsep) {
      if (jsep.type == "offer") {
        var body = {
          request: "configure",
          ptype: "publisher",
          room: self.my_room,
          display: username,
          audio: true,
          video: true
        };
        var payload = {
          janus: "message",
          session_id: session,
          handle_id: handler,
          body: body,
          jsep: jsep
        };

        send(payload, function(response) {
          var event = response.janus;

          if (event == "error") {
            delete transactions[response.transaction];
            self.onError(response.error.reason);
            return;
          }

          if (event == "ack") {
            return;
          }

          var data = response.plugindata.data;

          if (data.error) {
            delete transactions[response.transaction];
            self.onError(data.error);
            return;
          }

          if (data.reason) {
            delete transactions[response.transaction];
            self.onError(data.reason);
            return;
          } else {
            delete transactions[response.transaction];

            peer.pub.id = data.id;
            peer.pub.pc.signal(response.jsep);
          }
        });
      } else if (jsep.candidate) {
        trickle(handler, jsep.candidate);
      }
    });
  };

  this.subscribe = function(publisher) {
    createHandler(session, function(error, result) {
      if (error) {
        self.onError(error);
        return;
      }

      peer.sub[publisher] = {};
      peer.sub[publisher].handler = result.handler;
      peer.sub[publisher].pc = new SimplePeer({
        constraints: {
          optional: [{ DtlsSrtpKeyAgreement: true }]
        },
        offerConstraints: {
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        },
        answerConstraints: {
          mandatory: {
            OfferToReceiveAudio: true,
            OfferToReceiveVideo: true
          }
        }
      });
      peer.sub[publisher].pc.on("signal", function(jsep) {
        if (jsep.type == "answer") {
          var payload = {
            janus: "message",
            session_id: session,
            handle_id: peer.sub[publisher].handler,
            jsep: jsep,
            body: {
              request: "start"
            }
          };

          send(payload, function(response) {
            var event = response.janus;

            if (event == "error") {
              delete transactions[response.transaction];
              self.onError(response.error.reason);
              return;
            }

            if (event == "ack") {
              return;
            }

            var data = response.plugindata.data;

            if (data.error) {
              delete transactions[response.transaction];
              self.onError(data.error);
              return;
            }

            var result = data.result;

            if (result) {
              delete transactions[response.transaction];
            }

            return;
          });
        } else if (jsep.candidate) {
          trickle(peer.sub[publisher].handler, jsep.candidate);
        }
      });
      peer.sub[publisher].pc.on("stream", function(stream) {
        self.onRemoteStream(publisher, stream);
      });

      var body = {
        request: "join",
        ptype: "listener",
        feed: publisher,
        room: self.my_room
      };
      var payload = {
        janus: "message",
        session_id: session,
        handle_id: peer.sub[publisher].handler,
        body: body
      };

      send(payload, function(response) {
        var event = response.janus;

        if (event == "error") {
          delete transactions[response.transaction];
          self.onError(response.error.reason);
          return;
        }

        if (event == "ack") {
          return;
        }

        var data = response.plugindata.data;

        if (data.error) {
          delete transactions[response.transaction];
          self.onError(data.error);
          return;
        }

        if (data.reason) {
          delete transactions[response.transaction];
          self.onError(data.reason);
          return;
        } else {
          delete transactions[response.transaction];

          var jsep = response.jsep;

          peer.sub[publisher].pc.signal(response.jsep);
        }
      });
    });
  };

  this.unpublish = function() {
    var body = {
      request: "unpublish"
    };
    var payload = {
      janus: "message",
      session_id: session,
      handle_id: handler,
      body: body
    };

    send(payload, function(response) {
      delete transactions[response.transaction];
    });

    peer.pub.pc.destroy();
    peer.pub = {};
  };

  this.closeSession = function() {
    websocket.close();
  };

  //- End Public Method
}

VideoRoom.prototype.onReady = function() {};

VideoRoom.prototype.onLocalStream = function(stream) {};

VideoRoom.prototype.onRemoteStream = function(id, stream) {};

VideoRoom.prototype.onEvent = function(event, data) {};

VideoRoom.prototype.onError = function(error) {};
