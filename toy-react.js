const RENDER_TO_DOM = Symbol("render to dom");

export class Component {
    constructor(content) {
        this.props = Object.create(null);
        this.children = [];
        this._root = null;
        this._range = null;
    }
    setAttribute(name, value) {
        this.props[name] = value;
    }
    appendChild(component) {
        this.children.push(component);
    }
    get vdom () {
        return this.render().vdom;
    }
    
    // 使用[RENDER_TO_DOM]的形式来达到申明私有成员的效果
    [RENDER_TO_DOM](range) {
        this._range = range;  //保存range
        this._vdom = this.vdom;  //将vdom保存下来，作为vdom比对的旧vdom
        //这里的render类似于JAVA或C++中的抽象方法。因为JAVASCRIPT是所类型的语言，
        //所以直接写一个需要在子类中实现的方法即可（因为弱类型，所以不需要在这里声明）
        this._vdom[RENDER_TO_DOM](range);   //递归
    }

    update (){
        let isSameNode = (oldNode, newNode) => {
            // 类型不同
            if(oldNode.type !== newNode.type)
                return false;

            // 属性不同
            for (let name in newNode.props) {
                if (newNode.props[name] !== oldNode.props[name]) {
                    return false;
                }
            }

            // 属性的数量不同
            if (Object.keys(oldNode.props).length > Object.keys(newNode.props).length)
                return false;

            // 文本内容不同
            if (newNode.type === "#text") {
                if(newNode.content !== oldNode.content)
                    return false;
            }

            return true;
        }
        
        let update = (oldNode, newNode) => {
            // 先处理根节点
            // 先后比较type, props, children
            // #text还需要看content
            if (!isSameNode(oldNode, newNode)) {
                // 直接用新的覆盖旧的
                newNode[RENDER_TO_DOM](oldNode._range); 
                return;
            }
            // 节点一样，则直接强行设置
            newNode._range = oldNode._range;

            // 开始处理children
            let newChildren = newNode.vchildren;  //newNode.children里面放的是Component，所以用vchildren
            let oldChildren = oldNode.vchildren;

            if (!newChildren || !newChildren.length) {
                return;
            }

            let tailRange = oldChildren[oldChildren.length - 1]._range;

            for (let i  = 0; i < newChildren.length; i++) {
                let newChild = newChildren[i];
                let oldChild = oldChildren[i];
                if (i < oldChildren.length) {
                    update(oldChild, newChild);
                }else {
                    // 创建插入的空range
                    let range = document.createRange();
                    range.setStart(tailRange.endContainer, tailRange.endOffset);
                    range.setEnd(tailRange.endContainer, tailRange.endOffset);
                    newChild[RENDER_TO_DOM](range);
                    tailRange = range; //为下一次插入移动到新的结尾
                    // TODO
                }
            }

        }
        let vdom = this.vdom;
        update(this._vdom, vdom);
        this._vdom = vdom;  //新vdom更新完毕，变成下一轮更新的旧vdom
    }

    /*
    rerender() {
        // 保存老的range
        let oldRange = this._range;

        // 在老Range开始创建新的Range
        let range = document.createRange();
        range.setStart(oldRange.startContainer, oldRange.startOffset);
        range.setEnd(oldRange.startContainer, oldRange.startOffset);
        this[RENDER_TO_DOM](range);  // 和[RENDER_TO_DOM](range)中不同，这里不再递归
 
        // 将老range的开始移动到新插入range之后
        oldRange.setStart(range.endContainer, range.endOffset);
        oldRange.deleteContents();
        
    }
    */
    setState(newState) {
        //因为typeof null === "object"，所以null值判断要单独进行
        if (this.state === null || typeof this.state !== "object") {
            this.state = newState;
            this.rerender();
            return;
        }
        
        let merge = (oldState, newState) => {
            for (let p in newState){
                //因为typeof null === "object"，所以null值判断要单独进行
                if(oldState[p] === null || typeof oldState[p] !== "object") {
                    // p属性不是对象，直接抄写
                    oldState[p] = newState[p];
                } else {
                    merge(oldState[p], newState[p]);
                }
            }
        }
        merge(this.state, newState);
        this.update();
    }
}

class ElementWrapper extends Component{
    constructor(type) {
        super(type);
        this.type = type;
    }
    /*
    setAttribute(name, value) {
        if(name.match(/^on([\s\S]+)/)) {
            this.root.addEventListener(RegExp.$1.replace(/^[\s\S]/, c => c.toLowerCase()), value);
        }else {
            if (name === "className") {
                this.root.setAttribute("class", value);
            } else {
                this.root.setAttribute(name, value);
            }
            
        }
    }
    
    appendChild(commponent) {
        let range = document.createRange();
        // 添加到最后的位置
        range.setStart(this.root, this.root.childNodes.length);
        // 不能用parentElement.children，因为可能是文本或者注释节点
        range.setEnd(this.root, this.root.childNodes.length);
        commponent[RENDER_TO_DOM](range);
        
    }
    */
    get vdom (){
        this.vchildren = this.children.map(child => child.vdom);  //递归调用
        return this;
        /*
        return {
            type: this.type,
            props: this.props,
            children: this.children.map(child => child.vdom)
        }
        */
    }
    
    [RENDER_TO_DOM](range) {
        this._range = range;

        
        let root = document.createElement(this.type);

        for (let name in this.props) {
            let value = this.props[name];
            if(name.match(/^on([\s\S]+)/)) {
                root.addEventListener(RegExp.$1.replace(/^[\s\S]/, c => c.toLowerCase()), value);
            }else {
                if (name === "className") {
                    root.setAttribute("class", value);
                } else {
                    root.setAttribute(name, value);
                }
                
            }
        }

        // 确保vchildren一定存在
        if (!this.vchildren)
            this.vchildren = this.children.map(child => child.vdom);

        for (let child of this.vchildren) {
            let childRange = document.createRange();
            // 添加到最后的位置
            childRange.setStart(root, root.childNodes.length);
            // 不能用parentElement.children，因为可能是文本或者注释节点
            childRange.setEnd(root, root.childNodes.length);
            child[RENDER_TO_DOM](childRange);
        }

        replaceContent(range, root);
    }
}

class TextWrapper extends Component{
    constructor(content) {
        super(content);
        this.type = "#text";
        this.content = content;
    }
    get vdom () {
        return this;
        /*
        return {
            type: "#text",
            content: this.content
        }
        */
    }
    [RENDER_TO_DOM](range) {
        this._range = range;
        
        let root = document.createTextNode(this.content);
        replaceContent(range, root);
    }
}

function replaceContent(range, node) {
    range.insertNode(node);  //插在最前的位置
    range.setStartAfter(node); //将range挪到node之后
    range.deleteContents();  //将node之后的内容删除

    // 将range的位置改回来
    range.setStartBefore(node);
    range.setEndAfter(node);
}

export function createElement(type, attributes, ...children){
    let e;
    if (typeof type === "string") {
        e = new ElementWrapper(type);
    } else {
        e = new type;
    }

    for (let p in attributes) {
        e.setAttribute(p, attributes[p]);
    }

    let insertChildren = (children) => {
        for(let child of children) {
            if (typeof child === "string"){
                child = new TextWrapper(child);
            }
            if (child === null) {
                continue;
            }
            if (typeof child === "object" && (child instanceof Array)){
                insertChildren(child);
            } else {
                e.appendChild(child);
            }
            
        }
    }

    insertChildren(children);

    
    return e;
}

export function render(component, parentElement) {
    // parentElement.appendChild(component.root);
    let range = document.createRange();
    range.setStart(parentElement, 0);
    // 不能用parentElement.children，因为可能是文本或者注释节点
    range.setEnd(parentElement, parentElement.childNodes.length);
    range.deleteContents();
    component[RENDER_TO_DOM](range); 
}