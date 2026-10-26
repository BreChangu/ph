
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BlogPost } from '../../core/models/blog-post.model';
import { BlogService } from '../../core/services/blog';

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

  isLoading = true;
  hasError = false;

  constructor(private blogService: BlogService) {}

  ngOnInit(): void {
    this.loadPosts();
  }

  loadPosts(): void {
    this.isLoading = true;
    this.hasError = false;

    this.blogService.getPosts().subscribe({
      next: (posts) => {
        const publishedPosts = (posts ?? [])
          .filter(post => post.published === true)
          .sort(
            (a, b) =>
              new Date(b.date).getTime() -
              new Date(a.date).getTime()
          );

        this.featuredPost = publishedPosts[0];
        this.gridPosts = publishedPosts.slice(1);
        this.isLoading = false;
      },

      error: (error) => {
        console.error(
          'No se pudieron cargar los artículos del blog:',
          error
        );

        this.featuredPost = undefined;
        this.gridPosts = [];
        this.hasError = true;
        this.isLoading = false;
      }
    });
  }
}
