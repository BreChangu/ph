import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common'; 
import { BlogPost } from '../../core/models/blog-post.model';
import { BlogService } from '../../core/services/blog';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-blog',
  standalone: true, 
  imports: [CommonModule, RouterLink],
  templateUrl: './blog.html',
  styleUrls: ['./blog.scss']
})
export class BlogComponent implements OnInit {
  
  featuredPost?: BlogPost;
  gridPosts: BlogPost[] = [];
  isLoading: boolean = true; 

  constructor(private blogService: BlogService) { }

  ngOnInit(): void {
    this.loadPosts();
  }

  loadPosts(): void {
    this.blogService.getPosts().subscribe({
      next: (posts) => {
        if (posts && posts.length > 0) {
          this.featuredPost = posts[0]; 
          this.gridPosts = posts.slice(1); 
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error al cargar el blog', err);
        this.isLoading = false;
      }
    });
  }
}